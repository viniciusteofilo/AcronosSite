import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getDb } from "@/db/client";
import { AdminPageHeader } from "@/components/admin/page-header";
import { formatMoney } from "@/lib/money";
import { requireStaff } from "@/server/auth";
import { PAY_LABEL, SHIP_LABEL } from "@/lib/order-labels";
import { listOrdersAdmin, ORDER_VIEWS } from "@/server/orders/admin";

export const metadata: Metadata = { title: "Orders" };

export default function OrdersPage({ searchParams }: PageProps<"/admin/orders">) {
  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader title="Orders" description="Orders are marked paid only when Stripe or PayPal confirm the payment." />
      <Suspense fallback={<p className="text-muted">Loading…</p>}>
        <List searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function List({ searchParams }: Pick<PageProps<"/admin/orders">, "searchParams">) {
  const ctx = await requireStaff("orders:read");
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const data = await listOrdersAdmin(getDb(), ctx, { view: one(sp.view), q: one(sp.q), page: one(sp.page) });
  const count = (k: string) => (k in data.counts ? ` (${data.counts[k as keyof typeof data.counts]})` : "");
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <nav aria-label="Filter" className="flex flex-wrap gap-4 font-mono text-[11px] uppercase tracking-[0.12em]">
          {Object.entries(ORDER_VIEWS).map(([k, l]) => (
            <Link key={k} href={`/admin/orders?view=${k}`} aria-current={data.filter.view === k ? "page" : undefined} className={data.filter.view === k ? "text-ink underline underline-offset-4" : k === "attention" && data.counts.attention ? "text-alert" : "text-muted hover:text-ink"}>
              {l}
              {count(k)}
            </Link>
          ))}
        </nav>
        <form method="get" action="/admin/orders" role="search" className="flex gap-2">
          <input type="hidden" name="view" value="all" />
          <input type="search" name="q" defaultValue={data.filter.q ?? ""} placeholder="Number, e-mail or name" aria-label="Search orders" className="h-10 w-64 border border-field bg-paper px-3 text-sm" />
          <button type="submit" className="h-10 border border-field px-4 font-mono text-[10px] uppercase tracking-[0.14em] hover:border-ink">
            Search
          </button>
        </form>
      </div>
      {data.items.length === 0 ? (
        <p className="border border-dashed border-field p-8 text-sm">No orders here.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-line text-left font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
                <th className="py-2 pr-3 font-normal">Order</th>
                <th className="py-2 pr-3 font-normal">Customer</th>
                <th className="py-2 pr-3 font-normal">Total</th>
                <th className="py-2 pr-3 font-normal">Payment</th>
                <th className="py-2 pr-3 font-normal">Shipping</th>
                <th className="py-2 font-normal">Date</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((o) => (
                <tr key={o.id} className="border-b border-line">
                  <td className="py-2 pr-3">
                    <Link href={`/admin/orders/${o.id}`} className="font-mono text-xs hover:underline">
                      {o.number}
                    </Link>
                    {o.needsAttention && <span className="block text-xs text-alert">Needs attention</span>}
                  </td>
                  <td className="py-2 pr-3">
                    {o.name ?? "—"}
                    <span className="block text-xs text-muted">
                      {o.email} · {o.country} · {o.items} item(s)
                    </span>
                  </td>
                  <td className="py-2 pr-3 font-mono">{formatMoney(o.totalMinor, o.currency)}</td>
                  <td className={`py-2 pr-3 text-xs ${o.paymentStatus === "paid" ? "text-signal" : ""}`}>
                    {PAY_LABEL[o.paymentStatus]}
                    {o.provider && <span className="block text-muted">{o.provider}</span>}
                  </td>
                  <td className="py-2 pr-3 text-xs">{SHIP_LABEL[o.fulfillmentStatus]}</td>
                  <td className="py-2 text-xs text-muted">{new Date(o.createdAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
