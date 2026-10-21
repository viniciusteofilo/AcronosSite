import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getDb } from "@/db/client";
import { AdminPageHeader } from "@/components/admin/page-header";
import { formatMoney } from "@/lib/money";
import { requireStaff } from "@/server/auth";
import { listAdminProducts } from "@/server/catalog/admin";
import { hasPermission } from "@/server/rbac/permissions";

export const metadata: Metadata = { title: "Products" };

const TABS = [
  ["all", "All"],
  ["published", "Published"],
  ["draft", "Drafts"],
  ["archived", "Archived"],
] as const;

export default function ProductsPage({ searchParams }: PageProps<"/admin/products">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading products…</p>}>
      <ProductList searchParams={searchParams} />
    </Suspense>
  );
}

async function ProductList({ searchParams }: Pick<PageProps<"/admin/products">, "searchParams">) {
  const ctx = await requireStaff("products:read");
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const parsed = { q: one(sp.q), status: one(sp.status) as "all" | undefined, page: one(sp.page) };
  const safe = ["all", "published", "draft", "archived"].includes(parsed.status ?? "all") ? parsed : { ...parsed, status: undefined };
  const data = await listAdminProducts(getDb(), ctx, safe);
  const canEdit = hasPermission(ctx.roles, "products:write");
  const allCount = Object.values(data.counts).reduce((a, b) => a + (b ?? 0), 0);
  const href = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = { q: data.filter.q, status: data.filter.status === "all" ? undefined : data.filter.status, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    const s = p.toString();
    return `/admin/products${s ? `?${s}` : ""}`;
  };

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        title="Products"
        description="Everything in the shop. Drafts and archived products are never shown to customers."
        actions={
          <>
            <Link href="/admin/products/categories" className="inline-flex h-10 items-center border border-field px-4 font-mono text-[10px] uppercase tracking-[0.14em] hover:border-ink">
              Categories
            </Link>
            {canEdit && (
              <Link href="/admin/products/new" className="inline-flex h-10 items-center bg-ink px-5 font-mono text-[10px] uppercase tracking-[0.14em] text-canvas hover:bg-muted">
                New product
              </Link>
            )}
          </>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <nav aria-label="Filter by status" className="flex flex-wrap gap-4 font-mono text-[11px] uppercase tracking-[0.12em]">
          {TABS.map(([key, label]) => {
            const count = key === "all" ? allCount : (data.counts[key] ?? 0);
            const active = data.filter.status === key;
            return (
              <Link key={key} href={href({ status: key === "all" ? undefined : key, page: undefined })} aria-current={active ? "page" : undefined} className={active ? "text-ink underline underline-offset-4" : "text-muted hover:text-ink"}>
                {label} <span className="text-muted">({count})</span>
              </Link>
            );
          })}
        </nav>
        <form action="/admin/products" method="get" role="search" className="flex gap-2">
          {data.filter.status !== "all" && <input type="hidden" name="status" value={data.filter.status} />}
          <input type="search" name="q" defaultValue={data.filter.q ?? ""} placeholder="Name or SKU" aria-label="Search products by name or SKU" className="h-10 w-56 border border-field bg-paper px-3 text-sm" />
          <button type="submit" className="h-10 border border-field px-4 font-mono text-[10px] uppercase tracking-[0.14em] hover:border-ink">
            Search
          </button>
        </form>
      </div>

      {data.items.length === 0 ? (
        <div className="flex flex-col items-start gap-3 border border-dashed border-field p-8">
          <p className="text-sm">{data.filter.q ? `No products match “${data.filter.q}”.` : "No products here yet."}</p>
          {canEdit && !data.filter.q && (
            <Link href="/admin/products/new" className="text-sm underline">
              Create the first product
            </Link>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-line text-left font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
                <th className="py-2 pr-3 font-normal" colSpan={2}>Product</th>
                <th className="py-2 pr-3 font-normal">Status</th>
                <th className="py-2 pr-3 font-normal">Price</th>
                <th className="py-2 pr-3 font-normal">Available</th>
                <th className="py-2 pr-3 font-normal">Variants</th>
                <th className="py-2 font-normal">Updated</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((p) => {
                const scheduled = p.status === "published" && p.publishedAt && new Date(p.publishedAt) > new Date();
                const price = p.minUsd === null ? "—" : p.minUsd === p.maxUsd ? formatMoney(p.minUsd, "USD") : `${formatMoney(p.minUsd, "USD")} – ${formatMoney(p.maxUsd!, "USD")}`;
                return (
                  <tr key={p.id} className="border-b border-line hover:bg-paper">
                    <td className="w-14 py-2 pr-3">
                      <div className="aspect-[4/5] w-11 overflow-hidden border border-line bg-canvas">
                        {p.image && (
                          // eslint-disable-next-line @next/next/no-img-element -- admin thumbnail
                          <img src={p.image.src} srcSet={p.image.srcSet} sizes="44px" alt="" className="h-full w-full object-cover" style={{ objectPosition: `${p.image.focalX * 100}% ${p.image.focalY * 100}%` }} />
                        )}
                      </div>
                    </td>
                    <td className="py-2 pr-3">
                      <Link href={`/admin/products/${p.id}`} className="font-medium hover:underline">
                        {p.name}
                      </Link>
                      <span className="block text-xs text-muted">{[p.category, p.missingPrice && p.variants > 0 ? "missing USD price" : null, p.variants === 0 ? "no variants" : null].filter(Boolean).join(" · ")}</span>
                    </td>
                    <td className="py-2 pr-3">
                      <span className={`inline-flex h-6 items-center border px-2 font-mono text-[10px] uppercase tracking-[0.14em] ${p.status === "published" ? "border-signal/60 text-signal" : "border-line text-muted"}`}>
                        {scheduled ? "Scheduled" : p.status}
                      </span>
                    </td>
                    <td className="py-2 pr-3 whitespace-nowrap">{price}</td>
                    <td className={`py-2 pr-3 ${p.available === 0 && p.variants > 0 ? "text-alert" : ""}`}>{p.variants === 0 ? "—" : p.available === 0 ? "Sold out" : p.available}</td>
                    <td className="py-2 pr-3">{p.variants}</td>
                    <td className="py-2 whitespace-nowrap text-xs text-muted">{new Date(p.updatedAt).toLocaleDateString("en-US", { dateStyle: "medium" })}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {data.pages > 1 && (
        <nav aria-label="Pages" className="flex gap-4 font-mono text-xs">
          {data.filter.page > 1 && <Link href={href({ page: String(data.filter.page - 1) })}>← Previous</Link>}
          <span className="text-muted">
            Page {data.filter.page} of {data.pages}
          </span>
          {data.filter.page < data.pages && <Link href={href({ page: String(data.filter.page + 1) })}>Next →</Link>}
        </nav>
      )}
    </div>
  );
}
