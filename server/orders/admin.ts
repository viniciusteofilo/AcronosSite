import { notifyOrderRefunded, notifyOrderShipped } from "@/server/email/notify";
import { randomUUID } from "node:crypto";
import { and, desc, eq, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "@/db/client";
import { inventoryMovements, orderItems, orders, PAYMENT_STATUS, paymentEvents, payments, refunds, shipments, users } from "@/db/schema";
import { UserError, authorize } from "@/server/admin/errors";
import { recordAudit } from "@/server/audit/log";
import { applyStockDelta } from "@/server/catalog/inventory";
import type { Providers } from "@/server/payments";
import { ProviderError } from "@/server/payments/types";
import type { AccessContext } from "@/server/rbac/access";
import { hasPermission } from "@/server/rbac/permissions";
import { cancelPendingOrder, releaseExpiredReservations } from "./checkout";

export const ORDER_VIEWS = {
  to_ship: "To ship",
  all: "All",
  attention: "Needs attention",
  pending: "Awaiting payment",
  shipped: "Shipped",
  refunded: "Refunded",
  canceled: "Canceled",
} as const;

export async function listOrdersAdmin(db: Database, actor: AccessContext | null, raw: { view?: string; q?: string; page?: string | number }, pageSize = 50) {
  authorize(actor, "orders:read");
  await releaseExpiredReservations(db);
  const f = z
    .object({
      view: z.enum(Object.keys(ORDER_VIEWS) as [keyof typeof ORDER_VIEWS]).catch("to_ship"),
      q: z.string().trim().max(120).optional(),
      page: z.coerce.number().int().min(1).max(10_000).catch(1),
    })
    .parse(raw);
  const where: SQL[] = [];
  const v = f.view;
  if (v === "to_ship") where.push(sql`${orders.paymentStatus} = 'paid' AND ${orders.fulfillmentStatus} IN ('unfulfilled', 'partially_shipped') AND ${orders.processingStatus} <> 'canceled'`);
  if (v === "attention") where.push(sql`${orders.needsAttention} IS NOT NULL`);
  if (v === "pending") where.push(eq(orders.paymentStatus, "pending"));
  if (v === "shipped") where.push(sql`${orders.fulfillmentStatus} IN ('shipped', 'delivered')`);
  if (v === "refunded") where.push(sql`${orders.paymentStatus} IN ('refunded', 'partially_refunded')`);
  if (v === "canceled") where.push(sql`${orders.paymentStatus} IN ('canceled', 'failed')`);
  if (f.q) {
    const term = `%${f.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    where.push(sql`(${orders.number} ILIKE ${term} OR ${orders.email} ILIKE ${term} OR ${orders.shippingAddress}->>'fullName' ILIKE ${term})`);
  }
  const rows = await db
    .select({
      id: orders.id,
      number: orders.number,
      email: orders.email,
      name: sql<string | null>`${orders.shippingAddress}->>'fullName'`,
      country: orders.country,
      currency: orders.currency,
      totalMinor: orders.totalMinor,
      paymentStatus: orders.paymentStatus,
      processingStatus: orders.processingStatus,
      fulfillmentStatus: orders.fulfillmentStatus,
      provider: orders.paymentProvider,
      needsAttention: orders.needsAttention,
      createdAt: orders.createdAt,
      items: sql<number>`(SELECT coalesce(sum(oi.quantity), 0)::int FROM ${orderItems} oi WHERE oi.order_id = "orders"."id")`,
      total: sql<number>`count(*) OVER ()`,
    })
    .from(orders)
    .where(where.length ? and(...where) : undefined)
    .orderBy(desc(orders.createdAt))
    .limit(pageSize)
    .offset((f.page - 1) * pageSize);
  const counts = await db
    .select({
      to_ship: sql<number>`count(*) FILTER (WHERE ${orders.paymentStatus} = 'paid' AND ${orders.fulfillmentStatus} IN ('unfulfilled','partially_shipped') AND ${orders.processingStatus} <> 'canceled')::int`,
      attention: sql<number>`count(*) FILTER (WHERE ${orders.needsAttention} IS NOT NULL)::int`,
      pending: sql<number>`count(*) FILTER (WHERE ${orders.paymentStatus} = 'pending')::int`,
    })
    .from(orders);
  const total = Number(rows[0]?.total ?? 0);
  return {
    filter: f,
    counts: counts[0],
    total,
    pages: Math.max(1, Math.ceil(total / pageSize)),
    items: rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
  };
}

export async function getOrderAdmin(db: Database, actor: AccessContext | null, id: string) {
  const ctx = authorize(actor, "orders:read");
  if (!z.uuid().safeParse(id).success) return null;
  const [o] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  if (!o) return null;
  const [items, pays, ships, events, customer] = await Promise.all([
    db.select().from(orderItems).where(eq(orderItems.orderId, id)),
    db.select().from(payments).where(eq(payments.orderId, id)),
    db.select().from(shipments).where(eq(shipments.orderId, id)).orderBy(desc(shipments.createdAt)),
    o.providerCheckoutId
      ? db
          .select({ type: paymentEvents.type, receivedAt: paymentEvents.receivedAt, processedAt: paymentEvents.processedAt })
          .from(paymentEvents)
          .where(sql`${paymentEvents.payload}::text LIKE ${`%${o.providerCheckoutId}%`}`)
          .orderBy(desc(paymentEvents.receivedAt))
          .limit(20)
      : Promise.resolve([]),
    o.userId ? db.select({ id: users.id, name: users.name }).from(users).where(eq(users.id, o.userId)).limit(1) : Promise.resolve([]),
  ]);
  const refundRows = pays.length ? await db.select().from(refunds).where(sql`${refunds.paymentId} IN (${sql.join(pays.map((p) => sql`${p.id}`), sql`, `)})`) : [];
  const refunded = refundRows.filter((r) => r.status !== "failed").reduce((s, r) => s + r.amountMinor, 0);
  const canSeeAddress = hasPermission(ctx.roles, "customers:read_shipping");
  return {
    ...o,
    shippingAddress: canSeeAddress ? (o.shippingAddress as Record<string, string> | null) : null,
    shippingMethod: o.shippingMethod as { name: string; carrier: string | null; priceMinor: number; dutiesModel: string } | null,
    createdAt: o.createdAt.toISOString(),
    paidAt: o.paidAt?.toISOString() ?? null,
    items,
    payments: pays.map((p) => ({ ...p, createdAt: p.createdAt.toISOString() })),
    refunds: refundRows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
    refundedMinor: refunded,
    refundableMinor: pays.some((p) => p.status === "paid" || p.status === "partially_refunded") ? Math.max(0, o.totalMinor - refunded) : 0,
    shipments: ships.map((s) => ({ ...s, shippedAt: s.shippedAt?.toISOString() ?? null, deliveredAt: s.deliveredAt?.toISOString() ?? null })),
    events: events.map((e) => ({ ...e, receivedAt: e.receivedAt.toISOString() })),
    customer: customer[0] ?? null,
  };
}

const lock = async (tx: Parameters<Parameters<Database["transaction"]>[0]>[0], id: string) => {
  const [o] = await tx.select().from(orders).where(eq(orders.id, z.uuid().parse(id))).for("update");
  if (!o) throw new UserError("Order not found.");
  return o;
};

/** Marks a paid order as being prepared / ready to ship. */
export async function setProcessing(db: Database, actor: AccessContext | null, id: string, status: unknown) {
  const ctx = authorize(actor, "orders:update");
  const s = z.enum(["new", "processing", "ready"]).parse(status);
  await db.transaction(async (tx) => {
    const o = await lock(tx, id);
    if (o.paymentStatus !== "paid" && o.paymentStatus !== "partially_refunded") throw new UserError("Only paid orders can be prepared.");
    await tx.update(orders).set({ processingStatus: s, updatedAt: new Date() }).where(eq(orders.id, o.id));
    await recordAudit(tx, { actorId: ctx.userId, action: "order.processing", entityType: "order", entityId: o.id, before: { processingStatus: o.processingStatus }, after: { processingStatus: s } });
  });
}

const shipmentInput = z.object({
  carrier: z.string().trim().min(2, "Carrier is required").max(80),
  trackingNumber: z.string().trim().min(3, "Tracking number is required").max(80),
  trackingUrl: z
    .string()
    .trim()
    .max(500)
    .refine((v) => v === "" || /^https:\/\/\S+$/.test(v), "Tracking link must start with https://")
    .default(""),
});

export async function addShipment(db: Database, actor: AccessContext | null, id: string, raw: unknown) {
  const ctx = authorize(actor, "orders:update");
  const input = shipmentInput.parse(raw);
  await db.transaction(async (tx) => {
    const o = await lock(tx, id);
    if (o.paymentStatus !== "paid" && o.paymentStatus !== "partially_refunded") throw new UserError("Only paid orders can be shipped.");
    const now = new Date();
    await tx.insert(shipments).values({ orderId: o.id, carrier: input.carrier, trackingNumber: input.trackingNumber, trackingUrl: input.trackingUrl || null, shippedAt: now });
    await tx.update(orders).set({ fulfillmentStatus: "shipped", processingStatus: "completed", updatedAt: now }).where(eq(orders.id, o.id));
    await recordAudit(tx, { actorId: ctx.userId, action: "order.ship", entityType: "order", entityId: o.id, after: input });
  });
  await notifyOrderShipped(db, z.uuid().parse(id));
}

export async function markDelivered(db: Database, actor: AccessContext | null, id: string) {
  const ctx = authorize(actor, "orders:update");
  await db.transaction(async (tx) => {
    const o = await lock(tx, id);
    if (o.fulfillmentStatus !== "shipped") throw new UserError("Mark it as shipped first.");
    const now = new Date();
    await tx.update(shipments).set({ deliveredAt: now, updatedAt: now }).where(and(eq(shipments.orderId, o.id), sql`${shipments.deliveredAt} IS NULL`));
    await tx.update(orders).set({ fulfillmentStatus: "delivered", updatedAt: now }).where(eq(orders.id, o.id));
    await recordAudit(tx, { actorId: ctx.userId, action: "order.delivered", entityType: "order", entityId: o.id });
  });
}

export async function resolveAttention(db: Database, actor: AccessContext | null, id: string) {
  const ctx = authorize(actor, "orders:update");
  const [o] = await db.update(orders).set({ needsAttention: null, updatedAt: new Date() }).where(eq(orders.id, z.uuid().parse(id))).returning({ id: orders.id });
  if (!o) throw new UserError("Order not found.");
  await recordAudit(db, { actorId: ctx.userId, action: "order.attention_resolved", entityType: "order", entityId: id });
}

export async function cancelUnpaidByStaff(db: Database, actor: AccessContext | null, id: string) {
  const ctx = authorize(actor, "orders:update");
  const ok = await cancelPendingOrder(db, z.uuid().parse(id), `Canceled by ${ctx.email}`);
  if (!ok) throw new UserError("Only orders awaiting payment can be canceled here. Paid orders are refunded instead.");
}

const refundInput = z.object({
  amountMinor: z.number().int().positive("Enter an amount"),
  reason: z.string().trim().max(300).default(""),
  restock: z.boolean().default(false),
});

/**
 * Refunds through the provider that took the payment, up to what is left. The refund row is
 * written before the provider call is confirmed, so a crash never loses track of money sent back.
 */
export async function refundOrder(db: Database, actor: AccessContext | null, id: string, raw: unknown, providers: Providers) {
  const ctx = authorize(actor, "orders:refund");
  const input = refundInput.parse(raw);
  const [o] = await db.select().from(orders).where(eq(orders.id, z.uuid().parse(id))).limit(1);
  if (!o) throw new UserError("Order not found.");
  const [pay] = await db.select().from(payments).where(and(eq(payments.orderId, o.id), sql`${payments.status} IN ('paid','partially_refunded')`)).limit(1);
  if (!pay?.providerPaymentId) throw new UserError("This order has no payment to refund.");
  const provider = providers[pay.provider];
  if (!provider) throw new UserError(`${pay.provider} is not configured on this server, so the refund cannot be sent.`);
  const done = await db.select({ amount: refunds.amountMinor, status: refunds.status }).from(refunds).where(eq(refunds.paymentId, pay.id));
  const already = done.filter((r) => r.status !== "failed").reduce((s, r) => s + r.amount, 0);
  const left = o.totalMinor - already;
  if (input.amountMinor > left) throw new UserError(`You can refund at most ${(left / 100).toFixed(2)} ${o.currency}.`);

  const key = randomUUID();
  const [row] = await db.insert(refunds).values({ paymentId: pay.id, amountMinor: input.amountMinor, reason: input.reason || null, status: "pending", requestedBy: ctx.userId }).returning();
  let result;
  try {
    result = await provider.refund({ providerPaymentId: pay.providerPaymentId, amountMinor: input.amountMinor, currency: o.currency, idempotencyKey: key, reason: input.reason });
  } catch (e) {
    await db.update(refunds).set({ status: "failed", updatedAt: new Date() }).where(eq(refunds.id, row.id));
    throw new UserError(e instanceof ProviderError ? `The refund was not accepted: ${e.message}` : "The refund could not be sent. Nothing was refunded.");
  }
  const fully = already + input.amountMinor >= o.totalMinor;
  const status: (typeof PAYMENT_STATUS)[number] = fully ? "refunded" : "partially_refunded";
  await db.transaction(async (tx) => {
    await tx.update(refunds).set({ providerRefundId: result.providerRefundId, status: result.status, updatedAt: new Date() }).where(eq(refunds.id, row.id));
    if (result.status !== "failed") {
      await tx.update(payments).set({ status, updatedAt: new Date() }).where(eq(payments.id, pay.id));
      await tx.update(orders).set({ paymentStatus: status, ...(fully ? { processingStatus: "canceled" as const } : {}), updatedAt: new Date() }).where(eq(orders.id, o.id));
      if (input.restock) {
        const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, o.id));
        for (const it of items) {
          if (!it.variantId) continue;
          await applyStockDelta(tx, it.variantId, it.quantity, new Date());
          await tx.insert(inventoryMovements).values({ variantId: it.variantId, delta: it.quantity, reason: "return", orderId: o.id, note: `Refund ${o.number}`, actorId: ctx.userId });
        }
      }
    }
    await recordAudit(tx, { actorId: ctx.userId, action: "order.refund", entityType: "order", entityId: o.id, after: { amountMinor: input.amountMinor, status: result.status, restock: input.restock } });
  });
  if (result.status === "failed") throw new UserError("The provider rejected the refund. Nothing was refunded.");
  await notifyOrderRefunded(db, o.id, input.amountMinor, fully);
  return { status: result.status };
}
