import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { getDb } from "@/db/client";
import { ArrowRightIcon } from "@/components/icons";
import { Container, EmptyState, PageHeader } from "@/components/storefront/page-parts";
import { SiteImage } from "@/components/storefront/site-image";
import { listCollections } from "@/server/catalog/queries";

export const metadata: Metadata = {
  title: "Collections",
  description: "ACRONOS collections and archive.",
  alternates: { canonical: "/collections" },
};

export default function CollectionsPage() {
  return (
    <Container className="pb-24">
      <PageHeader eyebrow="Collections //" title="Collections" intro="Exploring new territories of tomorrow." />
      <Suspense fallback={<div className="min-h-[50svh]" aria-busy="true" />}>
        <CollectionList />
      </Suspense>
    </Container>
  );
}

async function CollectionList() {
  await connection();
  const items = await listCollections(getDb());
  if (items.length === 0) {
    return (
      <div className="pt-10">
        <EmptyState title="Collections are on the way" text="Each new collection will be presented here." />
      </div>
    );
  }
  return (
    <ul className="flex flex-col">
      {items.map((c, i) => (
        <li key={c.slug} className="border-b border-line py-8 lg:py-12">
          <article className="group relative grid items-center gap-6 lg:grid-cols-2 lg:gap-14">
            <div className={i % 2 === 1 ? "lg:order-2" : undefined}>
              <SiteImage media={c.image} label="Collection banner · 2400×1350" ratio="16/9" sizes="(min-width: 1024px) 50vw, 100vw" priority={i === 0} />
            </div>
            <div className="flex flex-col gap-4">
              <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted">
                {String(items.length - i).padStart(3, "0")} {"//"} {c.productCount} {c.productCount === 1 ? "product" : "products"}
              </p>
              <h2 className="font-display text-2xl uppercase tracking-[0.08em] sm:text-4xl">
                <Link href={`/collections/${c.slug}`} className="after:absolute after:inset-0">
                  {c.name}
                </Link>
              </h2>
              {c.description && <p className="max-w-md text-muted">{c.description}</p>}
              <span aria-hidden className="mt-2 flex h-11 w-11 items-center justify-center border border-ink/30 transition-colors group-hover:bg-ink group-hover:text-canvas">
                <ArrowRightIcon />
              </span>
            </div>
          </article>
        </li>
      ))}
    </ul>
  );
}
