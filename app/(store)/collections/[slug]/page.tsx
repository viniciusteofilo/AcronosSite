import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { getDb } from "@/db/client";
import { Container, EmptyState, GridSkeleton } from "@/components/storefront/page-parts";
import { ProductCard, toCard } from "@/components/storefront/product-card";
import { SiteImage } from "@/components/storefront/site-image";
import { Eyebrow } from "@/components/ui/eyebrow";
import { formatMoney } from "@/lib/money";
import { getCollectionBySlug, listProducts, shopFilterSchema, STORE_CURRENCY } from "@/server/catalog/queries";

export async function generateMetadata({ params }: PageProps<"/collections/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  await connection();
  const c = await getCollectionBySlug(getDb(), slug);
  if (!c) return { title: "Collection not found", robots: { index: false } };
  return {
    title: c.seoTitle ?? c.name,
    description: c.seoDescription ?? c.description ?? undefined,
    alternates: { canonical: `/collections/${c.slug}` },
  };
}

export default function CollectionPage({ params }: PageProps<"/collections/[slug]">) {
  return (
    <Suspense fallback={<Container className="pt-12"><GridSkeleton /></Container>}>
      <Collection params={params} />
    </Suspense>
  );
}

async function Collection({ params }: Pick<PageProps<"/collections/[slug]">, "params">) {
  const { slug } = await params;
  await connection();
  const db = getDb();
  const c = await getCollectionBySlug(db, slug);
  if (!c) notFound();
  const { items } = await listProducts(db, shopFilterSchema.parse({ collection: slug }), { limit: 48 });
  const fmt = (m: number) => formatMoney(m, STORE_CURRENCY);
  return (
    <>
      <Container className="grid gap-8 py-10 lg:grid-cols-[1fr_1.4fr] lg:items-end lg:py-14">
        <div className="flex flex-col gap-4">
          <Eyebrow>Collection //</Eyebrow>
          <h1 className="font-display text-3xl uppercase tracking-[0.08em] sm:text-5xl">{c.name}</h1>
          {c.description && <p className="max-w-md whitespace-pre-line text-muted">{c.description}</p>}
        </div>
        <SiteImage media={c.image} label="Collection banner · 2400×1350" ratio="16/9" priority sizes="(min-width: 1024px) 58vw, 100vw" />
      </Container>
      <Container className="border-t border-line pb-24 pt-12">
        {items.length === 0 ? (
          <EmptyState title="Products coming soon" text="The pieces of this collection will appear here when published." />
        ) : (
          <ul className="grid grid-cols-2 gap-x-4 gap-y-12 md:grid-cols-3 xl:grid-cols-4">
            {items.map((p) => (
              <li key={p.id}>
                <ProductCard product={toCard(p, fmt)} />
              </li>
            ))}
          </ul>
        )}
      </Container>
    </>
  );
}
