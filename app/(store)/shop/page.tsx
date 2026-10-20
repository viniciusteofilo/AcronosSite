import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { getDb } from "@/db/client";
import { ChevronDownIcon } from "@/components/icons";
import { AutoSubmitForm } from "@/components/storefront/auto-submit";
import { Container, EmptyState, GridSkeleton, PageHeader } from "@/components/storefront/page-parts";
import { ProductCard, toCard } from "@/components/storefront/product-card";
import { buttonClasses } from "@/components/ui/button";
import { formatMoney } from "@/lib/money";
import { getShopFacets, listProducts, parseShopFilters, STORE_CURRENCY, type ShopFilters } from "@/server/catalog/queries";

export const metadata: Metadata = {
  title: "Shop",
  description: "All ACRONOS products: techwear, streetwear and accessories.",
  alternates: { canonical: "/shop" },
};

export default function ShopPage({ searchParams }: PageProps<"/shop">) {
  return (
    <Container className="pb-24">
      <PageHeader eyebrow="Shop //" title="All products" />
      <Suspense
        fallback={
          <div className="pt-8">
            <GridSkeleton />
          </div>
        }
      >
        <ShopResults searchParams={searchParams} />
      </Suspense>
    </Container>
  );
}

async function ShopResults({ searchParams }: Pick<PageProps<"/shop">, "searchParams">) {
  const params = await searchParams;
  await connection();
  const filters = parseShopFilters(params);
  const db = getDb();
  const [result, facets] = await Promise.all([listProducts(db, filters), getShopFacets(db)]);
  const fmt = (m: number) => formatMoney(m, STORE_CURRENCY);
  const filtered =
    Boolean(filters.q || filters.category || filters.collection || filters.inStock || filters.size.length || filters.color.length) ||
    filters.min !== undefined ||
    filters.max !== undefined;
  const pageHref = (page: number) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (k === "page" || v === undefined) continue;
      for (const item of Array.isArray(v) ? v : [v]) qs.append(k, item);
    }
    if (page > 1) qs.set("page", String(page));
    const s = qs.toString();
    return s ? `/shop?${s}` : "/shop";
  };

  return (
    <div className="grid gap-10 pt-8 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-14">
      <aside aria-label="Filters">
        <details className="group border-b border-line pb-4 lg:hidden">
          <summary className="flex cursor-pointer list-none items-center justify-between font-mono text-[11px] uppercase tracking-[0.18em]">
            Filters <ChevronDownIcon width={16} className="transition-transform group-open:rotate-180" />
          </summary>
          <div className="pt-6">
            <Filters idPrefix="m" filters={filters} facets={facets} />
          </div>
        </details>
        <div className="hidden lg:block">
          <Filters idPrefix="d" filters={filters} facets={facets} />
        </div>
      </aside>

      <section aria-label="Products" className="min-w-0">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4 font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
          <p role="status">
            {result.total} {result.total === 1 ? "product" : "products"}
            {filters.q && <> for “{filters.q}”</>}
          </p>
          {filtered && (
            <Link href="/shop" className="underline underline-offset-4 hover:text-ink">
              Clear filters
            </Link>
          )}
        </div>
        {result.items.length === 0 ? (
          filtered ? (
            <EmptyState title="No products match" text="Try removing a filter or searching for something else.">
              <Link href="/shop" className={buttonClasses("secondary", "sm")}>
                Clear filters
              </Link>
            </EmptyState>
          ) : (
            <EmptyState title="New products are coming soon" text="The collection will appear here as soon as it is published." />
          )
        ) : (
          <ul className="grid grid-cols-2 gap-x-4 gap-y-12 md:grid-cols-3 xl:grid-cols-4">
            {result.items.map((p, i) => (
              <li key={p.id}>
                <ProductCard product={toCard(p, fmt)} priority={i < 4} />
              </li>
            ))}
          </ul>
        )}
        {result.pages > 1 && (
          <nav aria-label="Pages" className="mt-16 flex items-center justify-center gap-2 font-mono text-[11px]">
            {Array.from({ length: result.pages }, (_, i) => i + 1).map((n) => (
              <Link
                key={n}
                href={pageHref(n)}
                aria-current={n === result.page ? "page" : undefined}
                className={`flex h-10 min-w-10 items-center justify-center border px-2 ${n === result.page ? "border-ink bg-ink text-canvas" : "border-line hover:border-ink"}`}
              >
                {n}
              </Link>
            ))}
          </nav>
        )}
      </section>
    </div>
  );
}

function Filters({
  idPrefix,
  filters,
  facets,
}: {
  idPrefix: string;
  filters: ShopFilters;
  facets: Awaited<ReturnType<typeof getShopFacets>>;
}) {
  const group = "flex flex-col gap-3 border-b border-line pb-6";
  const legend = "mb-3 font-mono text-[10px] uppercase tracking-[0.2em] text-muted";
  const box = "h-4 w-4 shrink-0 appearance-none border border-field bg-surface checked:border-ink checked:bg-ink";
  return (
    <AutoSubmitForm action="/shop" className="flex flex-col gap-6">
      {filters.q && <input type="hidden" name="q" value={filters.q} />}
      <div className="flex flex-col gap-2">
        <label htmlFor={`${idPrefix}-sort`} className={legend}>
          Sort by
        </label>
        <select id={`${idPrefix}-sort`} name="sort" defaultValue={filters.sort} className="h-10 border border-field bg-surface px-3 text-sm">
          <option value="newest">Newest</option>
          <option value="price_asc">Price: low to high</option>
          <option value="price_desc">Price: high to low</option>
        </select>
      </div>
      {facets.categories.length > 0 && (
        <fieldset className={group}>
          <legend className={legend}>Category</legend>
          <label className="flex cursor-pointer items-center gap-3 text-sm">
            <input type="radio" name="category" value="" defaultChecked={!filters.category} className={`${box} rounded-full`} />
            All
          </label>
          {facets.categories.map((c) => (
            <label key={c.slug} className="flex cursor-pointer items-center gap-3 text-sm">
              <input type="radio" name="category" value={c.slug} defaultChecked={filters.category === c.slug} className={`${box} rounded-full`} />
              {c.name}
            </label>
          ))}
        </fieldset>
      )}
      {facets.sizes.length > 0 && (
        <fieldset className={group}>
          <legend className={legend}>Size</legend>
          <div className="flex flex-wrap gap-2">
            {facets.sizes.map((s) => (
              <label key={s} className="relative">
                <input type="checkbox" name="size" value={s} defaultChecked={filters.size.includes(s)} className="peer sr-only" />
                <span className="flex h-9 min-w-9 cursor-pointer items-center justify-center border border-field px-2 font-mono text-[11px] peer-checked:border-ink peer-checked:bg-ink peer-checked:text-canvas peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-signal">
                  {s}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      )}
      {facets.colors.length > 0 && (
        <fieldset className={group}>
          <legend className={legend}>Color</legend>
          {facets.colors.map((c) => (
            <label key={c.value} className="flex cursor-pointer items-center gap-3 text-sm">
              <input type="checkbox" name="color" value={c.value} defaultChecked={filters.color.includes(c.value)} className={box} />
              {c.hex && <span aria-hidden className="h-3 w-3 rounded-full border border-line" style={{ background: c.hex }} />}
              {c.value}
            </label>
          ))}
        </fieldset>
      )}
      <fieldset className={group}>
        <legend className={legend}>Price (USD)</legend>
        <div className="flex items-center gap-2">
          <input name="min" aria-label="Minimum price in dollars" placeholder="Min" inputMode="numeric" type="number" min={0} defaultValue={filters.min} className="h-10 w-full border border-field bg-surface px-3 font-mono text-xs" />
          <span className="text-muted">–</span>
          <input name="max" aria-label="Maximum price in dollars" placeholder="Max" inputMode="numeric" type="number" min={0} defaultValue={filters.max} className="h-10 w-full border border-field bg-surface px-3 font-mono text-xs" />
        </div>
      </fieldset>
      <label className="flex cursor-pointer items-center gap-3 text-sm">
        <input type="checkbox" name="stock" value="1" defaultChecked={filters.inStock} className={box} />
        In stock only
      </label>
      <button type="submit" className={buttonClasses("secondary", "sm")}>
        Apply
      </button>
    </AutoSubmitForm>
  );
}
