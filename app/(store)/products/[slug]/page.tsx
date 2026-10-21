import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { getDb } from "@/db/client";
import { CornerBrackets } from "@/components/graphics";
import { Container } from "@/components/storefront/page-parts";
import { ProductCard, toCard } from "@/components/storefront/product-card";
import { SiteImage } from "@/components/storefront/site-image";
import { VariantPicker } from "@/components/storefront/variant-picker";
import { Eyebrow } from "@/components/ui/eyebrow";
import { formatMoney } from "@/lib/money";
import { getProductBySlug, listProducts, shopFilterSchema, STORE_CURRENCY } from "@/server/catalog/queries";
import { getCheckoutReadiness } from "@/server/store/settings";

export async function generateMetadata({ params }: PageProps<"/products/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  await connection();
  const p = await getProductBySlug(getDb(), slug);
  if (!p) return { title: "Product not found", robots: { index: false } };
  const description = p.seoDescription ?? p.description?.slice(0, 160) ?? undefined;
  return {
    title: p.seoTitle ?? p.name,
    description,
    alternates: { canonical: `/products/${p.slug}` },
    openGraph: { title: p.name, description, images: p.images[0] ? [{ url: p.images[0].src }] : undefined },
  };
}

export default function ProductPage({ params }: PageProps<"/products/[slug]">) {
  return (
    <Suspense fallback={<Container className="min-h-[80svh]">{null}</Container>}>
      <Product params={params} />
    </Suspense>
  );
}

async function Product({ params }: Pick<PageProps<"/products/[slug]">, "params">) {
  const { slug } = await params;
  await connection();
  const db = getDb();
  const [p, readiness] = await Promise.all([getProductBySlug(db, slug), getCheckoutReadiness(db)]);
  if (!p) notFound();
  const fmt = (m: number) => formatMoney(m, STORE_CURRENCY);
  const related = p.category
    ? (await listProducts(db, shopFilterSchema.parse({ category: p.category.slug }), { limit: 5 })).items.filter((r) => r.id !== p.id).slice(0, 4)
    : [];
  const minPrice = Math.min(...p.variants.map((v) => v.priceMinor));
  const inStock = p.variants.some((v) => v.available > 0);
  const details = [
    { title: "Description", body: p.description },
    { title: "Composition & care", body: [p.composition, p.care].filter(Boolean).join("\n\n") || null },
    { title: "Technical details", body: p.technicalInfo },
    { title: "Shipping & duties", body: "Delivery options, import duties and taxes are shown at checkout, before you pay." },
    { title: "Returns", body: "See our returns policy for conditions and deadlines." },
  ].filter((d): d is { title: string; body: string } => Boolean(d.body));

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.name,
    sku: p.variants[0]?.sku,
    description: p.description ?? undefined,
    brand: { "@type": "Brand", name: "ACRONOS" },
    image: p.images.map((i) => i.src),
    offers: {
      "@type": "Offer",
      priceCurrency: STORE_CURRENCY,
      price: (minPrice / 100).toFixed(2),
      availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
    },
  };

  return (
    <Container className="pb-24">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <nav aria-label="Breadcrumb" className="py-6 font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
        <ol className="flex flex-wrap gap-2">
          <li>
            <Link href="/shop" className="hover:text-ink">Shop</Link>
          </li>
          {p.category && (
            <>
              <li aria-hidden>/</li>
              <li>
                <Link href={`/shop?category=${p.category.slug}`} className="hover:text-ink">{p.category.name}</Link>
              </li>
            </>
          )}
          <li aria-hidden>/</li>
          <li aria-current="page" className="text-ink">{p.name}</li>
        </ol>
      </nav>

      <div className="grid gap-10 lg:grid-cols-[1.35fr_1fr] lg:gap-16">
        <section aria-label="Product images" className="grid grid-cols-2 gap-2">
          {p.images.length === 0 ? (
            <div className="col-span-2">
              <SiteImage media={null} label="Product photo · 1600×2000" tone="product" />
            </div>
          ) : (
            p.images.map((img, i) => (
              <div key={img.id} className={i === 0 || p.images.length === 2 ? "col-span-2" : undefined}>
                <SiteImage media={img} label="" tone="product" priority={i === 0} sizes={i === 0 ? "(min-width: 1024px) 55vw, 100vw" : "(min-width: 1024px) 28vw, 50vw"} />
              </div>
            ))
          )}
        </section>

        <section aria-labelledby="product-name" className="lg:sticky lg:top-24 lg:self-start">
          <div className="flex flex-col gap-8">
            <div className="flex flex-col gap-3">
              <Eyebrow>
                {p.variants[0]?.sku}
                {p.collections[0] && <> · {p.collections[0].name}</>}
              </Eyebrow>
              <h1 id="product-name" className="font-display text-2xl uppercase tracking-[0.08em] sm:text-3xl">
                {p.name}
              </h1>
            </div>
            <VariantPicker
              checkoutOpen={readiness.open}
              variants={p.variants.map((v) => ({
                id: v.id,
                sku: v.sku,
                size: v.size,
                color: v.color,
                colorHex: v.colorHex,
                price: fmt(v.priceMinor),
                compareAt: v.compareAtMinor && v.compareAtMinor > v.priceMinor ? fmt(v.compareAtMinor) : null,
                available: v.available,
              }))}
            />
            <div className="border-t border-line">
              {details.map((d, i) => (
                <details key={d.title} open={i === 0} className="group border-b border-line">
                  <summary className="flex cursor-pointer list-none items-center justify-between py-4 font-mono text-[11px] uppercase tracking-[0.16em]">
                    {d.title}
                    <span aria-hidden className="text-muted transition-transform group-open:rotate-45">+</span>
                  </summary>
                  <p className="whitespace-pre-line pb-5 text-sm leading-relaxed text-muted">{d.body}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </div>

      {related.length > 0 && (
        <section aria-labelledby="related" className="mt-24">
          <div className="mb-8 flex items-center gap-4">
            <CornerBrackets className="h-5 w-5 text-muted" />
            <h2 id="related" className="font-mono text-[11px] uppercase tracking-[0.2em]">Related products</h2>
          </div>
          <ul className="grid grid-cols-2 gap-x-4 gap-y-10 lg:grid-cols-4">
            {related.map((r) => (
              <li key={r.id}>
                <ProductCard product={toCard(r, fmt)} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </Container>
  );
}
