import type { Metadata } from "next";
import { CornerBrackets } from "@/components/graphics";
import { ProductCard } from "@/components/storefront/product-card";
import { SiteFooter } from "@/components/storefront/site-footer";
import { SiteHeader } from "@/components/storefront/site-header";
import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/eyebrow";
import { MediaSlot } from "@/components/ui/media-slot";
import { ColorSelector, QuantityStepper, SizeSelector } from "@/components/ui/selectors";
import { PREVIEW_NAV, SAMPLE_COLORS, SAMPLE_PRODUCTS, SAMPLE_SIZES } from "../samples";

export const metadata: Metadata = { title: "Product" };

const DETAILS = [
  { title: "Description", body: "Product description written by ACRONOS: concept, fit and how it is meant to be worn." },
  { title: "Composition & care", body: "Fabric composition, trims and care instructions, as provided by production." },
  { title: "Technical details", body: "Technical features of the garment: construction, pockets, closures, weight." },
  { title: "Shipping & duties", body: "Delivery options and import duties are shown at checkout before payment." },
  { title: "Returns", body: "Return conditions are defined in the returns policy (pending legal review)." },
];

export default function ProductPreview() {
  return (
    <>
      <SiteHeader links={PREVIEW_NAV} current="Shop" cartCount={1} />
      <main id="main" className="mx-auto w-full max-w-[1440px] px-4 pb-24 sm:px-8">
        <nav aria-label="Breadcrumb" className="py-6 font-mono text-[10px] uppercase tracking-[0.18em] text-steel">
          <ol className="flex gap-2">
            <li>Shop</li>
            <li aria-hidden>/</li>
            <li>Outerwear</li>
            <li aria-hidden>/</li>
            <li aria-current="page" className="text-snow">Sample // Jacket</li>
          </ol>
        </nav>

        <div className="grid gap-10 lg:grid-cols-[1.35fr_1fr] lg:gap-16">
          <section aria-label="Product images" className="grid grid-cols-2 gap-2">
            <MediaSlot label="Front · 1600×2000" tone="light" className="col-span-2" />
            <MediaSlot label="Back" tone="light" />
            <MediaSlot label="Detail" tone="light" />
          </section>

          <section aria-labelledby="product-name" className="lg:sticky lg:top-24 lg:self-start">
            <div className="flex flex-col gap-8">
              <div className="flex flex-col gap-3">
                <Eyebrow>ACN-JK-000 · Collection name</Eyebrow>
                <h1 id="product-name" className="font-display text-2xl uppercase tracking-[0.08em] sm:text-3xl">
                  Sample // Jacket
                </h1>
                <p className="font-mono text-lg tracking-[0.06em]">$000.00</p>
                <p className="text-xs text-steel">Prices in USD. Duties and taxes calculated at checkout.</p>
              </div>
              <form className="flex flex-col gap-7">
                <ColorSelector name="color" options={SAMPLE_COLORS} defaultValue="graphite" />
                <div className="flex flex-col gap-2">
                  <SizeSelector name="size" options={SAMPLE_SIZES} />
                  <button type="button" className="self-start font-mono text-[10px] uppercase tracking-[0.18em] text-steel underline underline-offset-4 hover:text-snow">
                    Size guide
                  </button>
                </div>
                <QuantityStepper />
                <div className="flex flex-col gap-3">
                  <Button type="button" className="w-full">Add to cart</Button>
                  <p className="text-center font-mono text-[10px] uppercase tracking-[0.16em] text-steel">
                    Card · Apple Pay · Google Pay · PayPal
                  </p>
                </div>
              </form>
              <div className="border-t border-concrete">
                {DETAILS.map((d, i) => (
                  <details key={d.title} open={i === 0} className="group border-b border-concrete">
                    <summary className="flex cursor-pointer list-none items-center justify-between py-4 font-mono text-[11px] uppercase tracking-[0.16em]">
                      {d.title}
                      <span aria-hidden className="text-steel group-open:rotate-45 transition-transform">+</span>
                    </summary>
                    <p className="pb-5 text-sm leading-relaxed text-steel">{d.body}</p>
                  </details>
                ))}
              </div>
            </div>
          </section>
        </div>

        <section aria-labelledby="related" className="mt-24">
          <div className="mb-8 flex items-center gap-4">
            <CornerBrackets className="h-5 w-5 text-steel" />
            <h2 id="related" className="font-mono text-[11px] uppercase tracking-[0.2em]">Related products</h2>
          </div>
          <ul className="grid grid-cols-2 gap-x-4 gap-y-10 lg:grid-cols-4">
            {SAMPLE_PRODUCTS.slice(1, 5).map((p) => (
              <li key={p.code}>
                <ProductCard product={p} />
              </li>
            ))}
          </ul>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
