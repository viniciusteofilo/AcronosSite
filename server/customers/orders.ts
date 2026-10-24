import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "@/db/client";
import { orderItems, orders, payments, refunds, shipments } from "@/db/schema";

const customerOrderColumns = {
  id: orders.id,
  number: orders.number,
  currency: orders.currency,
  totalMinor: orders.totalMinor,
  paymentStatus: orders.paymentStatus,
  fulfillmentStatus: orders.fulfillmentStatus,
  createdAt: orders.createdAt,
};

/**
 * Customer-facing reads are always scoped to the signed-in user's id, which comes from the
 * session, never from the request. Asking for someone else's order returns nothing.
 */
export async function listOrdersForCustomer(db: Database, userId: string) {
  return db
    .select({ ...customerOrderColumns, items: sql<number>`(select coalesce(sum(oi.quantity), 0)::int from order_items oi where oi.order_id = ${orders}.id)` })
    .from(orders)
    .where(eq(orders.userId, userId))
    .orderBy(desc(orders.createdAt));
}

export async function getOrderForCustomer(db: Database, userId: string, orderId: string) {
  if (!z.uuid().safeParse(orderId).success) return null;
  const [row] = await db
    .select(customerOrderColumns)
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.userId, userId)))
    .limit(1);
  return row ?? null;
}

/** Everything the buyer may see about one order: items, shipments with tracking, refunds. */
export async function loadOrderView(db: Database, o: typeof orders.$inferSelect) {
  const [items, ships, pays] = await Promise.all([
    db.select().from(orderItems).where(eq(orderItems.orderId, o.id)),
    db.select().from(shipments).where(eq(shipments.orderId, o.id)).orderBy(asc(shipments.createdAt)),
    db.select({ id: payments.id }).from(payments).where(eq(payments.orderId, o.id)),
  ]);
  const refunded = pays.length
    ? await db
        .select({ amountMinor: refunds.amountMinor, createdAt: refunds.createdAt })
        .from(refunds)
        .where(and(inArray(refunds.paymentId, pays.map((p) => p.id)), eq(refunds.status, "succeeded")))
    : [];
  return {
    id: o.id,
    number: o.number,
    email: o.email,
    currency: o.currency,
    subtotalMinor: o.subtotalMinor,
    discountMinor: o.discountMinor,
    shippingMinor: o.shippingMinor,
    taxMinor: o.taxMinor,
    dutiesMinor: o.dutiesMinor,
    totalMinor: o.totalMinor,
    paymentStatus: o.paymentStatus,
    fulfillmentStatus: o.fulfillmentStatus,
    createdAt: o.createdAt,
    paidAt: o.paidAt,
    shippingAddress: o.shippingAddress as Record<string, string> | null,
    shippingMethod: o.shippingMethod as { name?: string } | null,
    items: items.map((i) => ({ id: i.id, productName: i.productName, options: [i.color, i.size].filter(Boolean).join(" / "), quantity: i.quantity, unitPriceMinor: i.unitPriceMinor })),
    shipments: ships.map((s) => ({ id: s.id, carrier: s.carrier, trackingNumber: s.trackingNumber, trackingUrl: s.trackingUrl, shippedAt: s.shippedAt, deliveredAt: s.deliveredAt })),
    refunds: refunded,
  };
}
export type OrderView = Awaited<ReturnType<typeof loadOrderView>>;

export async function getOrderViewForCustomer(db: Database, userId: string, orderId: string): Promise<OrderView | null> {
  if (!z.uuid().safeParse(orderId).success) return null;
  const [o] = await db.select().from(orders).where(and(eq(orders.id, orderId), eq(orders.userId, userId))).limit(1);
  return o ? loadOrderView(db, o) : null;
}
