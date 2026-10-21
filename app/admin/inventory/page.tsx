import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getDb } from "@/db/client";
import { InventoryTable } from "@/components/admin/inventory-table";
import { AdminPageHeader } from "@/components/admin/page-header";
import { requireStaff } from "@/server/auth";
import { inventoryFilter, listInventory } from "@/server/catalog/inventory";
import { adjustStockAction, listMovementsAction, setThresholdAction } from "../products/actions";

export const metadata: Metadata = { title: "Inventory" };

const VIEWS = [
  ["all", "All"],
  ["low", "Low stock"],
  ["out", "Sold out"],
] as const;

export default function InventoryPage({ searchParams }: PageProps<"/admin/inventory">) {
  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader title="Inventory" description="Stock of every active variant. Units in open orders are reserved and cannot be removed." />
      <Suspense fallback={<p className="text-muted">Loading…</p>}>
        <Inventory searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Inventory({ searchParams }: Pick<PageProps<"/admin/inventory">, "searchParams">) {
  const ctx = await requireStaff("inventory:adjust");
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const parsed = inventoryFilter.safeParse({ q: one(sp.q), view: one(sp.view) });
  const data = await listInventory(getDb(), ctx, parsed.success ? parsed.data : {});
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <nav aria-label="Filter" className="flex gap-4 font-mono text-[11px] uppercase tracking-[0.12em]">
          {VIEWS.map(([key, label]) => (
            <Link
              key={key}
              href={key === "all" ? "/admin/inventory" : `/admin/inventory?view=${key}`}
              aria-current={data.filter.view === key ? "page" : undefined}
              className={data.filter.view === key ? "text-ink underline underline-offset-4" : "text-muted hover:text-ink"}
            >
              {label}
            </Link>
          ))}
        </nav>
        <form method="get" action="/admin/inventory" role="search" className="flex gap-2">
          {data.filter.view !== "all" && <input type="hidden" name="view" value={data.filter.view} />}
          <input type="search" name="q" defaultValue={data.filter.q ?? ""} placeholder="Product or SKU" aria-label="Search inventory" className="h-10 w-56 border border-field bg-paper px-3 text-sm" />
          <button type="submit" className="h-10 border border-field px-4 font-mono text-[10px] uppercase tracking-[0.14em] hover:border-ink">
            Search
          </button>
        </form>
      </div>
      <InventoryTable
        key={JSON.stringify(data.filter)}
        rows={data.items}
        actions={{ adjust: adjustStockAction, threshold: setThresholdAction, history: listMovementsAction }}
      />
    </>
  );
}
