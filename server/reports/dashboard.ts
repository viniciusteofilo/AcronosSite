import { and, count, eq, gte, inArray, lte, sql, sum } from "drizzle-orm";
import type { Database } from "@/db/client";
import { inventoryLevels, orders } from "@/db/schema";
import { AccessDeniedError, decideStaffAccess, type AccessContext } from "@/server/rbac/access";

export const PERIOD_DAYS = [7, 30, 90] as const;
export type PeriodDays = (typeof PERIOD_DAYS)[number];

export function parsePeriod(value: unknown): PeriodDays {
  const n = Number(value);
  return (PERIOD_DAYS as readonly number[]).includes(n) ? (n as PeriodDays) : 30;
}

export type DashboardMetrics = {
  periodDays: PeriodDays;
  paidOrders: number;
  revenueByCurrency: { currency: string; amountMinor: number }[];
  toProcess: number;
  shipped: number;
  canceled: number;
  refunded: number;
  lowStockVariants: number;
};

/** Every number is computed from the database. With no sales yet, every number is zero. */
export async function getDashboardMetrics(
  db: Database,
  actor: AccessContext | null,
  periodDays: PeriodDays,
  now: Date = new Date(),
): Promise<DashboardMetrics> {
  const decision = decideStaffAccess(actor, "dashboard:view", now);
  if (!decision.ok) throw new AccessDeniedError(decision.reason);

  const since = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000);
  const inPeriod = and(gte(orders.createdAt, since), lte(orders.createdAt, now));
  const paidLike = inArray(orders.paymentStatus, ["paid", "partially_refunded"]);

  const countWhere = async (where: ReturnType<typeof and>) =>
    Number((await db.select({ n: count() }).from(orders).where(where))[0]?.n ?? 0);

  const [paidOrders, toProcess, shipped, canceled, refunded] = await Promise.all([
    countWhere(and(inPeriod, paidLike)),
    countWhere(and(paidLike, inArray(orders.processingStatus, ["new", "processing", "ready"]))),
    countWhere(and(inPeriod, inArray(orders.fulfillmentStatus, ["shipped", "delivered"]))),
    countWhere(and(inPeriod, eq(orders.processingStatus, "canceled"))),
    countWhere(and(inPeriod, inArray(orders.paymentStatus, ["refunded", "partially_refunded"]))),
  ]);

  const revenueRows = await db
    .select({ currency: orders.currency, amountMinor: sum(orders.totalMinor) })
    .from(orders)
    .where(and(inPeriod, paidLike))
    .groupBy(orders.currency);

  const [low] = await db
    .select({ n: count() })
    .from(inventoryLevels)
    .where(sql`${inventoryLevels.onHand} - ${inventoryLevels.reserved} <= ${inventoryLevels.lowStockThreshold}`);

  return {
    periodDays,
    paidOrders,
    revenueByCurrency: revenueRows.map((r) => ({
      currency: r.currency,
      amountMinor: Number(r.amountMinor ?? 0),
    })),
    toProcess,
    shipped,
    canceled,
    refunded,
    lowStockVariants: Number(low?.n ?? 0),
  };
}
