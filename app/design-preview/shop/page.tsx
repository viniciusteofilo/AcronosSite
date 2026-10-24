import type { Metadata } from "next";
import { ChevronDownIcon } from "@/components/icons";
import { ProductCard } from "@/components/storefront/product-card";
import { SiteFooter } from "@/components/storefront/site-footer";
import { SiteHeader } from "@/components/storefront/site-header";
import { Checkbox } from "@/components/ui/field";
import { Eyebrow } from "@/components/ui/eyebrow";
import { PREVIEW_NAV, SAMPLE_COLORS, SAMPLE_PRODUCTS, SAMPLE_SIZES } from "../samples";

export const metadata: Metadata = { title: "Shop" };

const CATEGORIES = ["All", "Outerwear", "Tops", "Pants", "Accessories"];

export default function ShopPreview() {
  return (
    <>
      <SiteHeader links={PREVIEW_NAV} current="Shop" />
      <main id="main" className="mx-auto w-full max-w-[1440px] px-4 pb-24 sm:px-8">
        <header className="flex flex-col gap-4 border-b border-line py-12 lg:py-16">
          <Eyebrow>Shop //</Eyebrow>
          <h1 className="font-display text-3xl uppercase tracking-[0.08em] sm:text-5xl">All products</h1>
        </header>

        <div className="grid gap-10 pt-8 lg:grid-cols-[220px_1fr] lg:gap-14">
          <aside aria-label="Filters">
            <details className="group border-b border-line pb-4 lg:hidden">
              <summary className="flex cursor-pointer list-none items-center justify-between font-mono text-[11px] uppercase tracking-[0.18em]">
                Filters <ChevronDownIcon width={16} className="transition-transform group-open:rotate-180" />
              </summary>
              <div className="pt-6"><Filters idPrefix="m" /></div>
            </details>
            <div className="hidden lg:block">
              <Filters idPrefix="d" />
            </div>
          </aside>

          <section aria-label="Products">
            <div className="mb-8 flex flex-wrap items-center justify-between gap-4 font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
              <p role="status">{SAMPLE_PRODUCTS.length} products</p>
              <label className="flex items-center gap-3">
                Sort by
                <select className="h-9 border border-line bg-surface px-3 text-ink">
                  <option>Newest</option>
                  <option>Price: low to high</option>
                  <option>Price: high to low</option>
                </select>
              </label>
            </div>
            <ul className="grid grid-cols-2 gap-x-4 gap-y-12 md:grid-cols-3 xl:grid-cols-4">
              {SAMPLE_PRODUCTS.map((p) => (
                <li key={p.code}>
                  <ProductCard product={p} />
                </li>
              ))}
            </ul>
          </section>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

function Filters({ idPrefix }: { idPrefix: string }) {
  const group = "flex flex-col gap-4 border-b border-line pb-6";
  const legend = "mb-4 font-mono text-[10px] uppercase tracking-[0.2em] text-muted";
  return (
    <form className="flex flex-col gap-6">
      <fieldset className={group}>
        <legend className={legend}>Category</legend>
        {CATEGORIES.map((c, i) => (
          <Checkbox key={c} id={`${idPrefix}-cat-${c}`} label={c} defaultChecked={i === 0} />
        ))}
      </fieldset>
      <fieldset className={group}>
        <legend className={legend}>Size</legend>
        <div className="flex flex-wrap gap-2">
          {SAMPLE_SIZES.map((s) => (
            <label key={s.value} className="relative">
              <input type="checkbox" className="peer sr-only" />
              <span className="flex h-9 min-w-9 cursor-pointer items-center justify-center border border-line px-2 font-mono text-[11px] peer-checked:border-ink peer-checked:bg-ink peer-checked:text-canvas peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-signal">
                {s.label}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className={group}>
        <legend className={legend}>Color</legend>
        {SAMPLE_COLORS.map((c) => (
          <label key={c.value} className="flex cursor-pointer items-center gap-3 text-sm">
            <input type="checkbox" className="h-4 w-4 appearance-none border border-muted/70 checked:border-ink checked:bg-ink" />
            <span aria-hidden className="h-3 w-3 rounded-full border border-line" style={{ background: c.swatch }} />
            {c.label}
          </label>
        ))}
      </fieldset>
      <fieldset className={group}>
        <legend className={legend}>Price (USD)</legend>
        <div className="flex items-center gap-2">
          <input aria-label="Minimum price" placeholder="Min" inputMode="numeric" className="h-10 w-full border border-line bg-surface px-3 font-mono text-xs" />
          <span className="text-muted">–</span>
          <input aria-label="Maximum price" placeholder="Max" inputMode="numeric" className="h-10 w-full border border-line bg-surface px-3 font-mono text-xs" />
        </div>
      </fieldset>
      <Checkbox id={`${idPrefix}-instock`} label="In stock only" />
    </form>
  );
}
