import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getDb } from "@/db/client";
import { AdminPageHeader } from "@/components/admin/page-header";
import { formatMoney } from "@/lib/money";
import { requireStaff } from "@/server/auth";
import { listCustomers } from "@/server/admin/people";

export const metadata: Metadata = { title: "Customers" };

export default function CustomersPage({ searchParams }: PageProps<"/admin/customers">) {
  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader title="Customers" description="Accounts created on the site. Staff accounts are listed under Users." />
      <Suspense fallback={<p className="text-muted">Loading…</p>}>
        <List searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function List({ searchParams }: Pick<PageProps<"/admin/customers">, "searchParams">) {
  const ctx = await requireStaff("customers:read");
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const data = await listCustomers(getDb(), ctx, { q: one(sp.q), page: one(sp.page) });
  return (
    <>
      <form method="get" action="/admin/customers" role="search" className="flex gap-2">
        <input type="search" name="q" defaultValue={data.filter.q ?? ""} placeholder="Name or e-mail" aria-label="Search customers" className="h-10 w-72 border border-field bg-paper px-3 text-sm" />
        <button type="submit" className="h-10 border border-field px-4 font-mono text-[10px] uppercase tracking-[0.14em] hover:border-ink">
          Search
        </button>
      </form>
      <p className="text-xs text-muted">{data.total} customer(s)</p>
      {data.items.length === 0 ? (
        <p className="border border-dashed border-field p-8 text-sm">No customers {data.filter.q ? "match this search" : "yet"}.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-line text-left font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
                <th className="py-2 pr-3 font-normal">Customer</th>
                <th className="py-2 pr-3 font-normal">Orders</th>
                <th className="py-2 pr-3 font-normal">Paid</th>
                <th className="py-2 pr-3 font-normal">Newsletter</th>
                <th className="py-2 font-normal">Since</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((c) => (
                <tr key={c.id} className="border-b border-line">
                  <td className="py-2 pr-3">
                    <Link href={`/admin/customers/${c.id}`} className="hover:underline">
                      {c.name}
                    </Link>
                    <span className="block text-xs text-muted">{c.email}</span>
                  </td>
                  <td className="py-2 pr-3">{c.orders}</td>
                  <td className="py-2 pr-3">{c.paid.length ? c.paid.map((p) => formatMoney(p.total, p.currency)).join(" · ") : "—"}</td>
                  <td className="py-2 pr-3 text-xs">{c.newsletter ?? "—"}</td>
                  <td className="py-2 text-xs text-muted">{new Date(c.createdAt).toLocaleDateString("en-US", { dateStyle: "medium" })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data.pages > 1 && (
        <nav aria-label="Pages" className="flex gap-4 font-mono text-xs">
          {data.filter.page > 1 && <Link href={`/admin/customers?page=${data.filter.page - 1}${data.filter.q ? `&q=${encodeURIComponent(data.filter.q)}` : ""}`}>← Previous</Link>}
          <span className="text-muted">Page {data.filter.page} of {data.pages}</span>
          {data.filter.page < data.pages && <Link href={`/admin/customers?page=${data.filter.page + 1}${data.filter.q ? `&q=${encodeURIComponent(data.filter.q)}` : ""}`}>Next →</Link>}
        </nav>
      )}
    </>
  );
}
