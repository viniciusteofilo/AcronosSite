import { randomBytes } from "node:crypto";
import { and, eq, inArray, isNull, lt, sql } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "@/db/client";
import { inventoryLevels, inventoryMovements, inventoryReservations, orderItems, orders, payments } from "@/db/schema";
import { UserError } from "@/server/admin/errors";
import { recordAudit } from "@/server/audit/log";
import { clearCart, getCart } from "@/server/cart/cart";
import type { Providers } from "@/server/payments";
import type { ConfirmedPayment, ProviderName } from "@/server/payments/types";
import { ProviderError } from "@/server/payments/types";
import { getCheckoutReadiness, getShippingOptions, getStoreSettings } from "@/server/store/settings";

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

export const addressSchema = z.object({
  fullName: z.string().trim().min(2, "Enter the recipient's full name").max(120),
  line1: z.string().trim().min(3, "Enter the street address").max(200),
  line2: z.string().trim().max(200).default(""),
  city: z.string().trim().min(2, "Enter the city").max(120),
  region: z.string().trim().max(120).default(""),
  postalCode: z.string().trim().min(2, "Enter the postal code").max(20),
  country: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/, "Choose a country"),
  phone: z.string().trim().max(40).default(""),
});

export const checkoutInput = z.object({
  email: z.email("Enter a valid e-mail").max(254),
  address: addressSchema,
  methodId: z.uuid("Choose a shipping method"),
  provider: z.enum(["stripe", "paypal"]),
  idempotencyKey: z.uuid(),
  acceptTerms: z.literal(true, { error: "Please accept the terms to continue." }),
});

function orderNumber(now: Date) {
  const d = now.toISOString().slice(2, 10).replace(/-/g, "");
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const rnd = [...randomBytes(6)].map((b) => alphabet[b % alphabet.length]).join("");
  return `ACN-${d}-${rnd}`;
}

/** Caps how much stock one checkout can hold; larger quantities go through wholesale contact. */
export const MAX_UNITS_PER_ORDER = 30;

export type StartedCheckout = { orderId: string; redirectUrl: string };

/**
 * Turns the cart into a pending order: prices and shipping are computed here (never trusted
 * from the browser), stock is reserved for a limited time, then the provider's hosted
 * checkout is created. The order is only marked paid later, by a verified provider message.
 */
export async function startCheckout(
  db: Database,
  raw: unknown,
  ctx: { cartId: string | null | undefined; userId: string | null; providers: Providers; siteUrl: string; now?: Date },
): Promise<StartedCheckout> {
  const now = ctx.now ?? new Date();
  const input = checkoutInput.parse(raw);

  const [existing] = await db.select().from(orders).where(eq(orders.idempotencyKey, input.idempotencyKey)).limit(1);
  if (existing) {
    if (existing.paymentStatus === "pending" && existing.checkoutUrl) return { orderId: existing.id, redirectUrl: existing.checkoutUrl };
    throw new UserError("This checkout was already submitted. Reload the page to start again.");
  }

  const settings = await getStoreSettings(db);
  const ready = await getCheckoutReadiness(db, settings);
  if (!ready.open) throw new UserError("Online orders are not open yet.");
  if (!ready.providers.includes(input.provider)) throw new UserError("This payment method is not available.");
  const provider = ctx.providers[input.provider];
  if (!provider) throw new UserError("This payment method is not available.");

  await releaseExpiredReservations(db, now);

  const options = await getShippingOptions(db);
  const method = options.get(input.address.country)?.find((m) => m.id === input.methodId);
  if (!method) throw new UserError("We do not ship to this country with the chosen method yet.", "methodId");

  const cart = await getCart(db, ctx.cartId, now);
  if (cart.lines.length === 0) throw new UserError("Your cart is empty.");
  if (cart.hasProblems) throw new UserError("Some items in your cart changed. Review your cart before paying.");
  if (cart.count > MAX_UNITS_PER_ORDER) throw new UserError(`Online orders are limited to ${MAX_UNITS_PER_ORDER} pieces. For larger quantities, contact us about wholesale.`);
  const currency = method.currency;
  const missing = cart.lines.filter((l) => l.prices[currency] === undefined);
  if (missing.length) throw new UserError(`${missing.map((l) => l.productName).join(", ")} cannot be shipped to this country yet.`);

  const subtotal = cart.lines.reduce((s, l) => s + l.prices[currency] * l.quantity, 0);
  const shipping = method.freeOverMinor !== null && subtotal >= method.freeOverMinor ? 0 : method.priceMinor;
  const total = subtotal + shipping;
  const publicToken = randomBytes(24).toString("hex");
  const expiresAt = new Date(now.getTime() + settings.reservationMinutes * 60_000);

  const order = await db.transaction(async (tx) => {
    const [o] = await tx
      .insert(orders)
      .values({
        number: orderNumber(now),
        userId: ctx.userId,
        email: input.email.toLowerCase(),
        merchantEntityId: settings.merchantEntityId!,
        currency,
        subtotalMinor: subtotal,
        shippingMinor: shipping,
        totalMinor: total,
        shippingAddress: input.address,
        shippingMethod: { id: method.id, name: method.name, carrier: method.carrier, priceMinor: shipping, dutiesModel: method.dutiesModel },
        country: input.address.country,
        idempotencyKey: input.idempotencyKey,
        paymentProvider: input.provider,
        publicToken,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    for (const l of cart.lines) {
      // Reserve atomically: the update only matches when enough units are free.
      const [held] = await tx
        .update(inventoryLevels)
        .set({ reserved: sql`${inventoryLevels.reserved} + ${l.quantity}`, updatedAt: now })
        .where(and(eq(inventoryLevels.variantId, l.variantId), sql`${inventoryLevels.onHand} - ${inventoryLevels.reserved} >= ${l.quantity}`))
        .returning({ v: inventoryLevels.variantId });
      if (!held) throw new UserError(`${l.productName} (${[l.color, l.size].filter(Boolean).join(" / ")}) just sold out in this quantity. Update your cart.`);
      await tx.insert(inventoryReservations).values({ variantId: l.variantId, orderId: o.id, quantity: l.quantity, expiresAt });
      await tx.insert(orderItems).values({
        orderId: o.id,
        variantId: l.variantId,
        productName: l.productName,
        sku: l.sku,
        size: l.size,
        color: l.color,
        unitPriceMinor: l.prices[currency],
        quantity: l.quantity,
      });
    }
    await recordAudit(tx, { actorId: ctx.userId, action: "order.create", entityType: "order", entityId: o.id, after: { number: o.number, total, currency, provider: input.provider } });
    return o;
  });

  const base = ctx.siteUrl.replace(/\/$/, "");
  try {
    const session = await provider.createCheckout({
      orderId: order.id,
      orderNumber: order.number,
      email: order.email,
      currency,
      items: cart.lines.map((l) => ({ name: l.productName, description: [l.color, l.size].filter(Boolean).join(" / ") || undefined, unitAmountMinor: l.prices[currency], quantity: l.quantity })),
      shipping: { name: method.name, amountMinor: shipping },
      totalMinor: total,
      successUrl:
        input.provider === "paypal"
          ? `${base}/checkout/paypal-return?order=${order.id}&t=${publicToken}`
          : `${base}/checkout/complete?order=${order.id}&t=${publicToken}`,
      cancelUrl: `${base}/checkout/canceled?order=${order.id}&t=${publicToken}`,
      expiresAt: Math.floor(expiresAt.getTime() / 1000),
      idempotencyKey: input.idempotencyKey,
    });
    await db.update(orders).set({ providerCheckoutId: session.providerCheckoutId, checkoutUrl: session.redirectUrl, updatedAt: new Date() }).where(eq(orders.id, order.id));
    if (cart.id) await clearCart(db, cart.id);
    return { orderId: order.id, redirectUrl: session.redirectUrl };
  } catch (e) {
    await cancelPendingOrder(db, order.id, "Payment could not be started", now);
    if (e instanceof ProviderError) console.error("[checkout]", e.message);
    throw new UserError("The payment page could not be opened. Nothing was charged. Please try again in a moment.");
  }
}

/** Gives reserved units back and closes an unpaid order. Safe to call twice. */
export async function cancelPendingOrder(db: Database, orderId: string, reason: string, now: Date = new Date()) {
  return db.transaction(async (tx) => {
    const [o] = await tx.select().from(orders).where(eq(orders.id, orderId)).for("update");
    if (!o || o.paymentStatus !== "pending") return false;
    await releaseReservations(tx, orderId, now);
    await tx
      .update(orders)
      .set({ paymentStatus: "canceled", processingStatus: "canceled", canceledAt: now, updatedAt: now })
      .where(eq(orders.id, orderId));
    await recordAudit(tx, { actorId: null, action: "order.cancel_unpaid", entityType: "order", entityId: orderId, after: { reason } });
    return true;
  });
}

async function releaseReservations(tx: Tx, orderId: string, now: Date) {
  const held = await tx
    .select()
    .from(inventoryReservations)
    .where(and(eq(inventoryReservations.orderId, orderId), isNull(inventoryReservations.releasedAt)));
  for (const r of held) {
    await tx
      .update(inventoryLevels)
      .set({ reserved: sql`greatest(${inventoryLevels.reserved} - ${r.quantity}, 0)`, updatedAt: now })
      .where(eq(inventoryLevels.variantId, r.variantId));
    await tx.update(inventoryReservations).set({ releasedAt: now }).where(eq(inventoryReservations.id, r.id));
  }
}

/** Closes unpaid orders whose stock hold has run out. Called on each checkout and by the admin. */
export async function releaseExpiredReservations(db: Database, now: Date = new Date()) {
  const due = await db
    .selectDistinct({ orderId: inventoryReservations.orderId })
    .from(inventoryReservations)
    .innerJoin(orders, eq(orders.id, inventoryReservations.orderId))
    .where(and(isNull(inventoryReservations.releasedAt), lt(inventoryReservations.expiresAt, now), eq(orders.paymentStatus, "pending")))
    .limit(200);
  for (const d of due) await cancelPendingOrder(db, d.orderId, "Checkout expired", now);
  return due.length;
}

/**
 * Records a payment confirmed by the provider (verified webhook or server-side capture).
 * Idempotent: the same payment arriving twice changes nothing. Turns the stock hold into a sale.
 */
export async function markOrderPaid(
  db: Database,
  provider: ProviderName,
  p: ConfirmedPayment,
  now: Date = new Date(),
): Promise<"paid" | "already" | "unknown_order"> {
  return db.transaction(async (tx) => {
    const [o] = await tx.select().from(orders).where(eq(orders.providerCheckoutId, p.providerCheckoutId)).for("update");
    if (!o) return "unknown_order";
    if (["paid", "partially_refunded", "refunded"].includes(o.paymentStatus)) return "already";

    const problems: string[] = [];
    if (p.orderCurrency !== o.currency || p.orderAmountMinor !== o.totalMinor) {
      problems.push(`Amount paid (${p.orderAmountMinor} ${p.orderCurrency}) differs from the order total (${o.totalMinor} ${o.currency}).`);
    }
    if (o.paymentStatus === "canceled") problems.push("Paid after the checkout had expired.");

    await tx
      .insert(payments)
      .values({
        orderId: o.id,
        provider,
        providerPaymentId: p.providerPaymentId,
        chargedCurrency: p.chargedCurrency,
        chargedAmountMinor: p.chargedAmountMinor,
        feeMinor: p.feeMinor ?? null,
        status: "paid",
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing();

    // stock: convert the hold into a sale; if the hold was already released, take the units if still free
    const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, o.id));
    const held = await tx.select().from(inventoryReservations).where(and(eq(inventoryReservations.orderId, o.id), isNull(inventoryReservations.releasedAt)));
    for (const it of items) {
      if (!it.variantId) continue;
      const res = held.find((h) => h.variantId === it.variantId);
      const [ok] = res
        ? await tx
            .update(inventoryLevels)
            .set({ onHand: sql`${inventoryLevels.onHand} - ${it.quantity}`, reserved: sql`${inventoryLevels.reserved} - ${res.quantity}`, updatedAt: now })
            .where(eq(inventoryLevels.variantId, it.variantId))
            .returning({ v: inventoryLevels.variantId })
        : await tx
            .update(inventoryLevels)
            .set({ onHand: sql`${inventoryLevels.onHand} - ${it.quantity}`, updatedAt: now })
            .where(and(eq(inventoryLevels.variantId, it.variantId), sql`${inventoryLevels.onHand} - ${inventoryLevels.reserved} >= ${it.quantity}`))
            .returning({ v: inventoryLevels.variantId });
      if (ok) {
        await tx.insert(inventoryMovements).values({ variantId: it.variantId, delta: -it.quantity, reason: "sale", orderId: o.id, note: o.number, createdAt: now });
      } else {
        problems.push(`Not enough stock for ${it.sku} (${it.quantity}).`);
      }
      if (res) await tx.update(inventoryReservations).set({ releasedAt: now }).where(eq(inventoryReservations.id, res.id));
    }

    await tx
      .update(orders)
      .set({
        paymentStatus: "paid",
        processingStatus: "new",
        paidAt: now,
        canceledAt: null,
        needsAttention: problems.length ? problems.join(" ") : null,
        updatedAt: now,
      })
      .where(eq(orders.id, o.id));
    await recordAudit(tx, { actorId: null, action: "order.paid", entityType: "order", entityId: o.id, after: { provider, payment: p.providerPaymentId, problems } });
    return "paid";
  });
}

/** The buyer's view of an order: only with the secret token from the confirmation link. */
export async function getOrderForBuyer(db: Database, orderId: string, token: string) {
  if (!z.uuid().safeParse(orderId).success || !/^[0-9a-f]{48}$/.test(token)) return null;
  const [o] = await db.select().from(orders).where(and(eq(orders.id, orderId), eq(orders.publicToken, token))).limit(1);
  if (!o) return null;
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, o.id));
  return { ...o, items };
}

/** Items of a canceled checkout, to put back in the cart. */
export async function itemsOfOrder(db: Database, orderIds: string[]) {
  if (!orderIds.length) return [];
  return db.select({ variantId: orderItems.variantId, quantity: orderItems.quantity }).from(orderItems).where(inArray(orderItems.orderId, orderIds));
}
