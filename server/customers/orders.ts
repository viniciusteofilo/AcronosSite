import { and, desc, eq } from "drizzle-orm";
import type { Database } from "@/db/client";
import { orders } from "@/db/schema";

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
    .select(customerOrderColumns)
    .from(orders)
    .where(eq(orders.userId, userId))
    .orderBy(desc(orders.createdAt));
}

export async function getOrderForCustomer(db: Database, userId: string, orderId: string) {
  const [row] = await db
    .select(customerOrderColumns)
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.userId, userId)))
    .limit(1);
  return row ?? null;
}
