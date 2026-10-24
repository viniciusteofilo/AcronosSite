import { emailLog } from "@/db/schema";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import Stripe from "stripe";
import { auditLogs, inventoryLevels, inventoryMovements, inventoryReservations, orders, paymentEvents, payments, refunds } from "@/db/schema";
import { runAdmin } from "@/server/admin/errors";
import { addToCart, getCart, setCartQuantity } from "@/server/cart/cart";
import { saveProduct } from "@/server/catalog/admin";
import { addShipment, getOrderAdmin, listOrdersAdmin, refundOrder } from "@/server/orders/admin";
import { cancelPendingOrder, getOrderForBuyer, markOrderPaid, releaseExpiredReservations, startCheckout } from "@/server/orders/checkout";
import { PayPalProvider } from "@/server/payments/paypal";
import { verifyStripeEvent } from "@/server/payments/stripe";
import type { CheckoutRequest, PaymentProvider } from "@/server/payments/types";
import { handlePayPalEvent, handleStripeEvent } from "@/server/payments/webhooks";
import { AccessDeniedError } from "@/server/rbac/access";
import { getCheckoutReadiness, saveMerchant, saveMethod, saveStoreSettings, saveZone } from "@/server/store/settings";
import { ctxFor, makeUser, testDb } from "../helpers";

const { db, client } = testDb();
const T = `k${Date.now().toString(36)}`;

process.env.STRIPE_SECRET_KEY = "sk_test_dummy";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_secret";
process.env.PAYPAL_CLIENT_ID = "id";
process.env.PAYPAL_CLIENT_SECRET = "secret";
process.env.PAYPAL_WEBHOOK_ID = "wh";

/** In-memory provider: records what the order code asked for. */
class FakeProvider implements PaymentProvider {
  environment = "sandbox" as const;
  requests: CheckoutRequest[] = [];
  refunds: { providerPaymentId: string; amountMinor: number }[] = [];
  fail = false;
  constructor(readonly name: "stripe" | "paypal") {}
  async createCheckout(req: CheckoutRequest) {
    if (this.fail) throw new Error("provider down");
    this.requests.push(req);
    return { providerCheckoutId: `${this.name}_cs_${this.requests.length}_${T}`, redirectUrl: `https://pay.example/${this.requests.length}` };
  }
  async refund(input: { providerPaymentId: string; amountMinor: number }) {
    this.refunds.push(input);
    return { providerRefundId: `re_${this.refunds.length}_${T}`, status: "succeeded" as const };
  }
}

const stripe = new FakeProvider("stripe");
const paypal = new FakeProvider("paypal");
const providers = { stripe, paypal };
let owner: ReturnType<typeof ctxFor>;
let variantM: string;
let variantL: string;
let usMethod: string;
let brMethod: string;

const address = (country = "US") => ({ fullName: "Ana Buyer", line1: "1 Main St", city: "Orlando", region: "FL", postalCode: "32801", country });
const level = async (v: string) => (await db.select().from(inventoryLevels).where(eq(inventoryLevels.variantId, v)))[0];

beforeAll(async () => {
  owner = ctxFor(await makeUser(db, { roles: ["super_admin"], twoFactorEnabled: true }), ["super_admin"]);
  const p = await saveProduct(db, owner, {
    name: `Checkout jacket ${T}`,
    slug: `checkout-jacket-${T}`,
    status: "published",
    variants: [
      { sku: `CJ-${T}-M`, size: "M", usd: "100", brl: "500", stock: 3 },
      { sku: `CJ-${T}-L`, size: "L", usd: "100", stock: 1 },
    ],
  });
  const { getProductForEditor } = await import("@/server/catalog/admin");
  const ed = await getProductForEditor(db, owner, p.id);
  variantM = ed!.variants.find((v) => v.size === "M")!.id;
  variantL = ed!.variants.find((v) => v.size === "L")!.id;
});

afterAll(async () => {
  await saveStoreSettings(db, owner, { checkoutOpen: false });
  await client.end();
});

describe("store setup", () => {
  it("stays closed until entity, shipping and payments are configured", async () => {
    const r = await getCheckoutReadiness(db);
    expect(r.open).toBe(false);
    const open = await runAdmin(() => saveStoreSettings(db, owner, { checkoutOpen: true }), "ok");
    expect(open.message).toMatch(/cannot open yet/);
    await expect(saveStoreSettings(db, { ...owner, roles: ["manager" as const] }, { checkoutOpen: true })).rejects.toBeInstanceOf(AccessDeniedError);

    await saveMerchant(db, owner, { legalName: "ACRONOS LTDA (test)", country: "br", taxId: "", settlementCurrency: "brl" });
    const us = await saveZone(db, owner, { name: "United States", countries: "us", isEnabled: true });
    usMethod = (await saveMethod(db, owner, { zoneId: us.id, name: "Standard", currency: "USD", priceMinor: 1500, freeOverMinor: 30000, dutiesModel: "ddu", isActive: true })).id;
    const br = await saveZone(db, owner, { name: "Brasil", countries: "BR", isEnabled: true });
    brMethod = (await saveMethod(db, owner, { zoneId: br.id, name: "Correios", currency: "BRL", priceMinor: 3000, dutiesModel: "domestic", isActive: true })).id;
    const clash = await runAdmin(() => saveZone(db, owner, { name: "Americas", countries: "US, CA", isEnabled: true }), "ok");
    expect(clash.message).toMatch(/Already in another active zone: US/);
    await saveStoreSettings(db, owner, { stripeEnabled: true, paypalEnabled: true, checkoutOpen: true });
    expect((await getCheckoutReadiness(db)).open).toBe(true);
  });
});

describe("cart", () => {
  it("adds, limits to available stock and updates quantities", async () => {
    const cart = await addToCart(db, null, { variantId: variantM, quantity: 2 });
    await expect(addToCart(db, cart, { variantId: variantM, quantity: 2 })).rejects.toThrow(/Only 3 available/);
    await addToCart(db, cart, { variantId: variantL, quantity: 1 });
    let view = await getCart(db, cart);
    expect(view).toMatchObject({ count: 3, subtotalUsd: 30000, hasProblems: false });
    await setCartQuantity(db, cart, { variantId: variantL, quantity: 0 });
    view = await getCart(db, cart);
    expect(view.count).toBe(2);
    expect(await getCart(db, "not-a-uuid")).toMatchObject({ count: 0 });
  });
});

describe("checkout and payment", () => {
  let cart: string;
  let orderId: string;

  it("creates a pending order with server prices, reserves stock and opens the provider checkout", async () => {
    cart = await addToCart(db, null, { variantId: variantM, quantity: 2 });
    const r = await startCheckout(
      db,
      { email: "Ana@Example.test", address: address(), methodId: usMethod, provider: "stripe", idempotencyKey: randomUUID(), acceptTerms: true },
      { cartId: cart, userId: null, providers, siteUrl: "https://shop.test" },
    );
    orderId = r.orderId;
    expect(r.redirectUrl).toMatch(/^https:\/\/pay\.example\//);
    const req = stripe.requests.at(-1)!;
    expect(req).toMatchObject({ currency: "USD", totalMinor: 21500, shipping: { amountMinor: 1500 }, email: "ana@example.test" });
    expect(req.successUrl).toMatch(/^https:\/\/shop\.test\/checkout\/complete\?order=/);
    const [o] = await db.select().from(orders).where(eq(orders.id, orderId));
    expect(o).toMatchObject({ paymentStatus: "pending", totalMinor: 21500, subtotalMinor: 20000, shippingMinor: 1500 });
    expect((await level(variantM)).reserved).toBe(2);
    expect((await getCart(db, cart)).count).toBe(0); // the cart moved into the order
    // the buyer page needs the secret token
    expect(await getOrderForBuyer(db, orderId, "0".repeat(48))).toBeNull();
    expect((await getOrderForBuyer(db, orderId, o.publicToken!))?.number).toBe(o.number);
  });

  it("refuses to sell more than is free, counting other people's open checkouts", async () => {
    const other = await addToCart(db, null, { variantId: variantM, quantity: 1 });
    await addToCart(db, other, { variantId: variantL, quantity: 1 });
    // someone else reserves the last L meanwhile
    await db.update(inventoryLevels).set({ reserved: 1 }).where(eq(inventoryLevels.variantId, variantL));
    const r = await runAdmin(
      () => startCheckout(db, { email: "b@example.test", address: address(), methodId: usMethod, provider: "stripe", idempotencyKey: randomUUID(), acceptTerms: true }, { cartId: other, userId: null, providers, siteUrl: "https://shop.test" }),
      "ok",
    );
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/changed|sold out/);
    await db.update(inventoryLevels).set({ reserved: 0 }).where(eq(inventoryLevels.variantId, variantL));
    expect((await level(variantM)).reserved).toBe(2); // nothing leaked from the failed attempt
  });

  it("uses BRL prices and shipping for Brazil and refuses items without a BRL price", async () => {
    const c1 = await addToCart(db, null, { variantId: variantL, quantity: 1 });
    const bad = await runAdmin(
      () => startCheckout(db, { email: "c@example.test", address: address("BR"), methodId: brMethod, provider: "paypal", idempotencyKey: randomUUID(), acceptTerms: true }, { cartId: c1, userId: null, providers, siteUrl: "https://shop.test" }),
      "ok",
    );
    expect(bad.message).toMatch(/cannot be shipped to this country/);
    const wrong = await runAdmin(
      () => startCheckout(db, { email: "c@example.test", address: address("BR"), methodId: usMethod, provider: "paypal", idempotencyKey: randomUUID(), acceptTerms: true }, { cartId: c1, userId: null, providers, siteUrl: "https://shop.test" }),
      "ok",
    );
    expect(wrong.message).toMatch(/do not ship/);
  });

  it("returning to the success page does not mark the order paid; only the verified payment does", async () => {
    const [o] = await db.select().from(orders).where(eq(orders.id, orderId));
    expect(o.paymentStatus).toBe("pending");
    const payload = JSON.stringify({
      id: `evt_${T}`,
      object: "event",
      type: "checkout.session.completed",
      data: { object: { id: o.providerCheckoutId, object: "checkout.session", payment_status: "paid", payment_intent: `pi_${T}`, currency: "usd", amount_total: 21500 } },
    });
    // forged signature is rejected
    expect(() => verifyStripeEvent(payload, "t=1,v1=deadbeef", process.env.STRIPE_WEBHOOK_SECRET!)).toThrow();
    const header = Stripe.webhooks.generateTestHeaderString({ payload, secret: process.env.STRIPE_WEBHOOK_SECRET! });
    const event = verifyStripeEvent(payload, header, process.env.STRIPE_WEBHOOK_SECRET!);
    expect(await handleStripeEvent(db, event)).toBe("paid");
    expect(await handleStripeEvent(db, event)).toBe("duplicate"); // replay is harmless
    const [paid] = await db.select().from(orders).where(eq(orders.id, orderId));
    expect(paid).toMatchObject({ paymentStatus: "paid", needsAttention: null });
    const lvl = await level(variantM);
    expect(lvl).toMatchObject({ onHand: 1, reserved: 0 });
    const moves = await db.select().from(inventoryMovements).where(eq(inventoryMovements.orderId, orderId));
    expect(moves.map((m) => [m.reason, m.delta])).toEqual([["sale", -2]]);
    expect(await db.select().from(payments).where(eq(payments.orderId, orderId))).toHaveLength(1);
    expect(await db.select().from(paymentEvents).where(eq(paymentEvents.providerEventId, `evt_${T}`))).toHaveLength(1);
  });

  it("flags a paid amount that does not match the order", async () => {
    const c = await addToCart(db, null, { variantId: variantM, quantity: 1 });
    const r = await startCheckout(db, { email: "d@example.test", address: address(), methodId: usMethod, provider: "stripe", idempotencyKey: randomUUID(), acceptTerms: true }, { cartId: c, userId: null, providers, siteUrl: "https://shop.test" });
    const [o] = await db.select().from(orders).where(eq(orders.id, r.orderId));
    await markOrderPaid(db, "stripe", { providerCheckoutId: o.providerCheckoutId!, providerPaymentId: `pi_x_${T}`, orderCurrency: "USD", orderAmountMinor: 1, chargedCurrency: "USD", chargedAmountMinor: 1 });
    const [after] = await db.select().from(orders).where(eq(orders.id, r.orderId));
    expect(after.needsAttention).toMatch(/differs from the order total/);
    const list = await listOrdersAdmin(db, owner, { view: "attention" });
    expect(list.items.map((i) => i.id)).toContain(r.orderId);
  });

  it("expired holds give the stock back; a late payment is accepted only if stock is still free", async () => {
    await db.update(inventoryLevels).set({ onHand: 5 }).where(eq(inventoryLevels.variantId, variantM));
    const c = await addToCart(db, null, { variantId: variantM, quantity: 2 });
    const r = await startCheckout(db, { email: "e@example.test", address: address(), methodId: usMethod, provider: "paypal", idempotencyKey: randomUUID(), acceptTerms: true }, { cartId: c, userId: null, providers, siteUrl: "https://shop.test" });
    expect(paypal.requests.at(-1)!.successUrl).toMatch(/\/checkout\/paypal-return\?/);
    expect((await level(variantM)).reserved).toBe(2);
    expect(await releaseExpiredReservations(db, new Date(Date.now() + 2 * 3600_000))).toBe(1);
    expect((await level(variantM)).reserved).toBe(0);
    const [o] = await db.select().from(orders).where(eq(orders.id, r.orderId));
    expect(o.paymentStatus).toBe("canceled");
    // PayPal webhook arrives late: stock is still free, so the sale goes through but is flagged
    expect(
      await handlePayPalEvent(db, {
        id: `WH-${T}`,
        event_type: "PAYMENT.CAPTURE.COMPLETED",
        resource: { id: `CAP-${T}`, amount: { currency_code: "USD", value: "215.00" }, supplementary_data: { related_ids: { order_id: o.providerCheckoutId! } } },
      }),
    ).toBe("paid");
    const [late] = await db.select().from(orders).where(eq(orders.id, r.orderId));
    expect(late.paymentStatus).toBe("paid");
    expect(late.needsAttention).toMatch(/after the checkout had expired/);
    expect((await level(variantM)).onHand).toBe(3);
  });

  it("a failed provider call cancels the order and frees the stock", async () => {
    const c = await addToCart(db, null, { variantId: variantM, quantity: 1 });
    stripe.fail = true;
    const r = await runAdmin(() => startCheckout(db, { email: "f@example.test", address: address(), methodId: usMethod, provider: "stripe", idempotencyKey: randomUUID(), acceptTerms: true }, { cartId: c, userId: null, providers, siteUrl: "https://shop.test" }), "ok");
    stripe.fail = false;
    expect(r.message).toMatch(/Nothing was charged/);
    expect((await level(variantM)).reserved).toBe(0);
    expect((await getCart(db, c)).count).toBe(1); // cart kept so they can retry
  });

  it("ships with tracking and refunds through the provider with restock", async () => {
    await addShipment(db, owner, orderId, { carrier: "USPS", trackingNumber: "9400100000000000000000", trackingUrl: "https://tools.usps.com/x" });
    const order = await getOrderAdmin(db, owner, orderId);
    expect(order).toMatchObject({ fulfillmentStatus: "shipped", refundableMinor: 21500 });
    const tooMuch = await runAdmin(() => refundOrder(db, owner, orderId, { amountMinor: 999999 }, providers), "ok");
    expect(tooMuch.message).toMatch(/at most 215.00 USD/);
    await expect(refundOrder(db, { ...owner, roles: ["order_manager" as const] }, orderId, { amountMinor: 100 }, providers)).rejects.toBeInstanceOf(AccessDeniedError);
    const before = (await level(variantM)).onHand;
    await refundOrder(db, owner, orderId, { amountMinor: 5000, reason: "Partial" }, providers);
    await refundOrder(db, owner, orderId, { amountMinor: 16500, reason: "Rest", restock: true }, providers);
    expect(stripe.refunds.map((r) => r.amountMinor)).toEqual([5000, 16500]);
    const [o] = await db.select().from(orders).where(eq(orders.id, orderId));
    expect(o.paymentStatus).toBe("refunded");
    expect((await level(variantM)).onHand).toBe(before + 2);
    const rows = await db.select().from(refunds);
    expect(rows.filter((r) => r.status === "succeeded").length).toBeGreaterThanOrEqual(2);
    const audit = await db.select().from(auditLogs).where(eq(auditLogs.entityId, orderId));
    expect(audit.map((a) => a.action)).toEqual(expect.arrayContaining(["order.create", "order.paid", "order.ship", "order.refund"]));
    // the buyer got one e-mail per step (kept in the test outbox: no provider in tests)
    const mails = await db.select().from(emailLog).where(eq(emailLog.ref, orderId));
    expect(mails.map((m) => m.kind).sort()).toEqual(["order_confirmation", "order_refunded", "order_refunded", "order_shipped"]);
    const shipped = mails.find((m) => m.kind === "order_shipped")!;
    expect(shipped.bodyHtml).toContain("9400100000000000000000");
    expect(shipped.bodyHtml).toContain("https://tools.usps.com/x");
    expect(mails.find((m) => m.kind === "order_confirmation")!.bodyText).toMatch(/Total: \$215\.00/);
  });

  it("canceling an unpaid checkout is idempotent", async () => {
    const c = await addToCart(db, null, { variantId: variantM, quantity: 1 });
    const r = await startCheckout(db, { email: "g@example.test", address: address(), methodId: usMethod, provider: "stripe", idempotencyKey: randomUUID(), acceptTerms: true }, { cartId: c, userId: null, providers, siteUrl: "https://shop.test" });
    expect(await cancelPendingOrder(db, r.orderId, "test")).toBe(true);
    expect(await cancelPendingOrder(db, r.orderId, "test")).toBe(false);
    const res = await db.select().from(inventoryReservations).where(eq(inventoryReservations.orderId, r.orderId));
    expect(res.every((x) => x.releasedAt)).toBe(true);
  });
});

describe("PayPal adapter", () => {
  it("creates an order with exact amounts and verifies webhooks with PayPal", async () => {
    const calls: { url: string; body: unknown }[] = [];
    const fake = (async (url: string, init?: RequestInit) => {
      const body = init?.body && typeof init.body === "string" && init.body.startsWith("{") ? JSON.parse(init.body) : init?.body;
      calls.push({ url, body });
      if (url.endsWith("/v1/oauth2/token")) return Response.json({ access_token: "tok", expires_in: 3600 });
      if (url.endsWith("/v2/checkout/orders")) return Response.json({ id: "PP-1", links: [{ rel: "payer-action", href: "https://www.sandbox.paypal.com/checkoutnow?token=PP-1" }] }, { status: 201 });
      if (url.endsWith("/verify-webhook-signature")) return Response.json({ verification_status: "FAILURE" });
      return Response.json({}, { status: 404 });
    }) as typeof fetch;
    const pp = new PayPalProvider("id", "secret", "sandbox", fake);
    const s = await pp.createCheckout({
      orderId: "o1", orderNumber: "ACN-1", email: "a@b.test", currency: "USD",
      items: [{ name: "Jacket", unitAmountMinor: 18900, quantity: 2 }], shipping: { name: "Std", amountMinor: 1500 }, totalMinor: 39300,
      successUrl: "https://s/ok", cancelUrl: "https://s/no", expiresAt: 0, idempotencyKey: "k",
    });
    expect(s).toEqual({ providerCheckoutId: "PP-1", redirectUrl: "https://www.sandbox.paypal.com/checkoutnow?token=PP-1" });
    const create = calls.find((c) => c.url.endsWith("/v2/checkout/orders"))!.body as { purchase_units: { amount: { value: string; breakdown: { item_total: { value: string } } } }[] };
    expect(create.purchase_units[0].amount.value).toBe("393.00");
    expect(create.purchase_units[0].amount.breakdown.item_total.value).toBe("378.00");
    expect(await pp.verifyWebhook(new Headers(), "{}", "wh")).toBe(false);
  });
});
