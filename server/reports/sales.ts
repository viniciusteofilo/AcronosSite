import { and, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "@/db/client";
import { orderItems, orders, payments, refunds } from "@/db/schema";
import { authorize } from "@/server/admin/errors";
import { recordAudit } from "@/server/audit/log";
import type { AccessContext } from "@/server/rbac/access";

const PAID = ["paid", "partially_refunded", "refunded"] as const;

export const reportPeriod = z.object({
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
});

/** Period in UTC days; defaults to the last 30 days, at most 366 days. */
export function resolvePeriod(raw: z.input<typeof reportPeriod>, now: Date = new Date()) {
  const p = reportPeriod.safeParse(raw);
  const day = (d: Date) => d.toISOString().slice(0, 10);
  const today = day(now);
  let to = p.success && p.data.to ? p.data.to : today;
  let from = p.success && p.data.from ? p.data.from : day(new Date(now.getTime() - 29 * 86_400_000));
  if (from > to) [from, to] = [to, from];
  const start = new Date(`${from}T00:00:00Z`);
  const end = new Date(new Date(`${to}T00:00:00Z`).getTime() + 86_400_000);
  if (end.getTime() - start.getTime() > 366 * 86_400_000) {
    from = day(new Date(end.getTime() - 366 * 86_400_000));
    return { from, to, start: new Date(`${from}T00:00:00Z`), end };
  }
  return { from, to, start, end };
}

/** Sales figures from paid orders only (by payment date). Each currency is reported separately. */
export async function salesReport(db: Database, actor: AccessContext | null, raw: z.input<typeof reportPeriod>) {
  authorize(actor, "reports:view");
  const period = resolvePeriod(raw);
  const inPeriod = and(inArray(orders.paymentStatus, [...PAID]), gte(orders.paidAt, period.start), lt(orders.paidAt, period.end));

  const [byDay, totals, top, countries, refundRows] = await Promise.all([
    db
      .select({ day: sql<string>`to_char(${orders.paidAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD')`, currency: orders.currency, orders: sql<number>`count(*)::int`, revenue: sql<number>`sum(${orders.totalMinor})::bigint` })
      .from(orders)
      .where(inPeriod)
      .groupBy(sql`1`, orders.currency)
      .orderBy(sql`1`),
    db
      .select({ currency: orders.currency, orders: sql<number>`count(*)::int`, revenue: sql<number>`sum(${orders.totalMinor})::bigint`, shipping: sql<number>`sum(${orders.shippingMinor})::bigint` })
      .from(orders)
      .where(inPeriod)
      .groupBy(orders.currency),
    db
      .select({ name: orderItems.productName, currency: orders.currency, units: sql<number>`sum(${orderItems.quantity})::int`, revenue: sql<number>`sum(${orderItems.quantity} * ${orderItems.unitPriceMinor})::bigint` })
      .from(orderItems)
      .innerJoin(orders, eq(orders.id, orderItems.orderId))
      .where(inPeriod)
      .groupBy(orderItems.productName, orders.currency)
      .orderBy(desc(sql`3`))
      .limit(15),
    db
      .select({ country: orders.country, orders: sql<number>`count(*)::int` })
      .from(orders)
      .where(inPeriod)
      .groupBy(orders.country)
      .orderBy(desc(sql`2`)),
    db
      .select({ currency: orders.currency, amount: sql<number>`sum(${refunds.amountMinor})::bigint` })
      .from(refunds)
      .innerJoin(payments, eq(payments.id, refunds.paymentId))
      .innerJoin(orders, eq(orders.id, payments.orderId))
      .where(and(eq(refunds.status, "succeeded"), gte(refunds.createdAt, period.start), lt(refunds.createdAt, period.end)))
      .groupBy(orders.currency),
  ]);
  const n = (v: unknown) => Number(v ?? 0);
  return {
    period: { from: period.from, to: period.to },
    byDay: byDay.map((r) => ({ ...r, revenue: n(r.revenue) })),
    totals: totals.map((t) => ({
      currency: t.currency,
      orders: t.orders,
      revenue: n(t.revenue),
      shipping: n(t.shipping),
      average: t.orders ? Math.round(n(t.revenue) / t.orders) : 0,
      refunded: n(refundRows.find((r) => r.currency === t.currency)?.amount),
    })),
    top: top.map((t) => ({ ...t, revenue: n(t.revenue) })),
    countries,
  };
}

const csvCell = (v: unknown) => {
  let s = v === null || v === undefined ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
};

/** Paid orders of the period as CSV for the accountant. Personal data limited to what invoices need. */
export async function ordersCsv(db: Database, actor: AccessContext | null, raw: z.input<typeof reportPeriod>) {
  const ctx = authorize(actor, "reports:export");
  const period = resolvePeriod(raw);
  const rows = await db
    .select({
      number: orders.number,
      paidAt: orders.paidAt,
      currency: orders.currency,
      subtotal: orders.subtotalMinor,
      shipping: orders.shippingMinor,
      total: orders.totalMinor,
      paymentStatus: orders.paymentStatus,
      provider: orders.paymentProvider,
      country: orders.country,
      email: orders.email,
      name: sql<string | null>`${orders.shippingAddress}->>'fullName'`,
      items: sql<string>`(SELECT string_agg(oi.sku || ' x' || oi.quantity, '; ') FROM ${orderItems} oi WHERE oi.order_id = "orders"."id")`,
    })
    .from(orders)
    .where(and(inArray(orders.paymentStatus, [...PAID]), gte(orders.paidAt, period.start), lt(orders.paidAt, period.end)))
    .orderBy(orders.paidAt);
  await recordAudit(db, { actorId: ctx.userId, action: "reports.export_orders", entityType: "report", after: { ...period, rows: rows.length } });
  const head = ["order", "paid_at_utc", "currency", "subtotal", "shipping", "total", "payment_status", "provider", "country", "email", "name", "items"];
  const money = (m: number) => (m / 100).toFixed(2);
  return {
    filename: `acronos-orders-${period.from}-to-${period.to}.csv`,
    csv: [head.join(","), ...rows.map((r) => [r.number, r.paidAt?.toISOString(), r.currency, money(r.subtotal), money(r.shipping), money(r.total), r.paymentStatus, r.provider, r.country, r.email, r.name, r.items].map(csvCell).join(","))].join("\r\n"),
  };
}
