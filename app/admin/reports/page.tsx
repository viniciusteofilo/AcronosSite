import type { Metadata } from "next";
import { Suspense } from "react";
import { getDb } from "@/db/client";
import { AdminPageHeader } from "@/components/admin/page-header";
import { formatMoney } from "@/lib/money";
import { requireStaff } from "@/server/auth";
import { hasPermission } from "@/server/rbac/permissions";
import { salesReport } from "@/server/reports/sales";

export const metadata: Metadata = { title: "Reports" };

export default function ReportsPage({ searchParams }: PageProps<"/admin/reports">) {
  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader title="Reports" description="Paid orders by payment date (UTC). Each currency is shown separately; nothing is converted." />
      <Suspense fallback={<p className="text-muted">Loading…</p>}>
        <Report searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

const box = "flex flex-col gap-3 border border-line bg-surface p-5";
const h2 = "font-display text-sm uppercase tracking-[0.1em]";

async function Report({ searchParams }: Pick<PageProps<"/admin/reports">, "searchParams">) {
  const ctx = await requireStaff("reports:view");
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const r = await salesReport(getDb(), ctx, { from: one(sp.from), to: one(sp.to) });
  const currencies = [...new Set(r.byDay.map((d) => d.currency))];
  return (
    <>
      <form method="get" className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs text-muted">
          From
          <input type="date" name="from" defaultValue={r.period.from} className="h-10 border border-field bg-paper px-3 text-sm text-ink" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          To
          <input type="date" name="to" defaultValue={r.period.to} className="h-10 border border-field bg-paper px-3 text-sm text-ink" />
        </label>
        <button type="submit" className="h-10 border border-field px-4 font-mono text-[10px] uppercase tracking-[0.14em] hover:border-ink">
          Show
        </button>
        {hasPermission(ctx.roles, "reports:export") && (
          <a href={`/api/admin/reports?from=${r.period.from}&to=${r.period.to}`} className="inline-flex h-10 items-center bg-ink px-5 font-mono text-[10px] uppercase tracking-[0.14em] text-canvas hover:bg-muted">
            Download orders (CSV)
          </a>
        )}
      </form>

      {r.totals.length === 0 ? (
        <p className="border border-dashed border-field p-8 text-sm">No paid orders in this period.</p>
      ) : (
        <>
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {r.totals.map((t) => (
              <li key={t.currency} className={box}>
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">Revenue · {t.currency}</span>
                <span className="text-2xl">{formatMoney(t.revenue, t.currency)}</span>
                <span className="text-xs text-muted">
                  {t.orders} {t.orders === 1 ? "order" : "orders"} · average {formatMoney(t.average, t.currency)} · shipping {formatMoney(t.shipping, t.currency)}
                  {t.refunded > 0 && ` · refunded ${formatMoney(t.refunded, t.currency)}`}
                </span>
              </li>
            ))}
          </ul>
          {currencies.map((c) => {
            const days = r.byDay.filter((d) => d.currency === c);
            const max = Math.max(...days.map((d) => d.revenue), 1);
            return (
              <section key={c} className={box} aria-label={`Revenue per day in ${c}`}>
                <h2 className={h2}>Revenue per day · {c}</h2>
                <ul className="flex flex-col gap-1">
                  {days.map((d) => (
                    <li key={d.day} className="grid grid-cols-[90px_minmax(0,1fr)_120px] items-center gap-3 text-xs">
                      <span className="font-mono text-muted">{d.day}</span>
                      <span className="h-3 bg-ink" style={{ width: `${Math.max(1, (d.revenue / max) * 100)}%` }} aria-hidden />
                      <span className="text-right font-mono">
                        {formatMoney(d.revenue, c)} · {d.orders}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
          <div className="grid gap-6 lg:grid-cols-2">
            <section className={box}>
              <h2 className={h2}>Best sellers</h2>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
                    <th className="py-1 font-normal">Product</th>
                    <th className="py-1 text-right font-normal">Units</th>
                    <th className="py-1 text-right font-normal">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {r.top.map((t) => (
                    <tr key={`${t.name}-${t.currency}`} className="border-t border-line">
                      <td className="py-1">{t.name}</td>
                      <td className="py-1 text-right">{t.units}</td>
                      <td className="py-1 text-right font-mono">{formatMoney(t.revenue, t.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
            <section className={box}>
              <h2 className={h2}>Orders by country</h2>
              <ul className="text-sm">
                {r.countries.map((c) => (
                  <li key={c.country ?? "?"} className="flex justify-between border-t border-line py-1">
                    <span>{c.country ?? "—"}</span>
                    <span>{c.orders}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </>
      )}
    </>
  );
}
