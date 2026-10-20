import Link from "next/link";
import { Suspense } from "react";
import { getDb } from "@/db/client";
import { formatMoney } from "@/lib/money";
import { requireStaff } from "@/server/auth";
import { PERIOD_DAYS, getDashboardMetrics, parsePeriod } from "@/server/reports/dashboard";

export default function AdminDashboardPage({ searchParams }: PageProps<"/admin">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading metrics…</p>}>
      <Dashboard searchParams={searchParams} />
    </Suspense>
  );
}

async function Dashboard({ searchParams }: Pick<PageProps<"/admin">, "searchParams">) {
  const ctx = await requireStaff("dashboard:view");
  const period = parsePeriod((await searchParams).days);
  const m = await getDashboardMetrics(getDb(), ctx, period);

  const revenue =
    m.revenueByCurrency.length === 0
      ? "—"
      : m.revenueByCurrency.map((r) => formatMoney(r.amountMinor, r.currency)).join(" · ");

  const cards = [
    { label: "Paid orders", sub: `last ${m.periodDays} days`, value: String(m.paidOrders) },
    { label: "Revenue", sub: "paid, by currency", value: revenue },
    { label: "To process", sub: "paid, not shipped", value: String(m.toProcess) },
    { label: "Low stock", sub: "variants at threshold", value: String(m.lowStockVariants) },
    { label: "Shipped", sub: `last ${m.periodDays} days`, value: String(m.shipped) },
    { label: "Canceled", sub: `last ${m.periodDays} days`, value: String(m.canceled) },
    { label: "Refunded", sub: `last ${m.periodDays} days`, value: String(m.refunded) },
  ];

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="font-display text-xl uppercase tracking-[0.08em]">Dashboard</h1>
        <nav aria-label="Period" className="flex gap-3 font-mono text-xs uppercase tracking-[0.1em]">
          {PERIOD_DAYS.map((d) => (
            <Link
              key={d}
              href={`/admin?days=${d}`}
              aria-current={d === m.periodDays ? "page" : undefined}
              className={d === m.periodDays ? "text-ink underline underline-offset-4" : "text-muted hover:text-ink"}
            >
              {d} days
            </Link>
          ))}
        </nav>
      </header>
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => (
          <li key={c.label} className="flex flex-col gap-1 border border-line p-4">
            <span className="font-mono text-xs uppercase tracking-[0.1em] text-muted">{c.label}</span>
            <span className="text-2xl">{c.value}</span>
            <span className="text-xs text-muted">{c.sub}</span>
          </li>
        ))}
      </ul>
      <p className="text-sm text-muted">
        Figures come straight from the database. The store is not selling yet, so they are zero.
      </p>
    </div>
  );
}
