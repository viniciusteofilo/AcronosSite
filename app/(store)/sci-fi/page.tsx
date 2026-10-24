import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { getDb } from "@/db/client";
import { Container, EmptyState, PageHeader } from "@/components/storefront/page-parts";
import { SiteImage } from "@/components/storefront/site-image";
import { listStories } from "@/server/content/stories";

export const metadata: Metadata = {
  title: "Acronos Sci-Fi",
  description: "Stories of other tomorrows: original science fiction about technology, humanity and the future.",
  alternates: { canonical: "/sci-fi" },
};

const dateFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

export default function SciFiPage() {
  return (
    <Container className="pb-24">
      <PageHeader eyebrow="Acronos Sci-Fi //" title="Stories of other tomorrows" intro="Original short stories about technology, humanity and the future." />
      <Suspense fallback={<div className="min-h-[50svh]" aria-busy="true" />}>
        <Library />
      </Suspense>
    </Container>
  );
}

async function Library() {
  await connection();
  const items = await listStories(getDb());
  if (items.length === 0) {
    return (
      <div className="pt-10">
        <EmptyState title="The first stories are being written" text="Published stories will appear here." />
      </div>
    );
  }
  const [featured, ...rest] = items;
  return (
    <div className="flex flex-col gap-16 pt-10">
      <article className="group relative grid gap-6 lg:grid-cols-[1.3fr_1fr] lg:items-center lg:gap-14">
        <SiteImage media={featured.cover} label="Story cover · 2400×1200" ratio="2/1" priority sizes="(min-width: 1024px) 56vw, 100vw" />
        <div className="flex flex-col gap-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
            Latest · {dateFmt.format(featured.date)}
            {featured.readingMinutes ? ` · ${featured.readingMinutes} min read` : ""}
          </p>
          <h2 className="font-display text-2xl uppercase tracking-[0.06em] sm:text-4xl">
            <Link href={`/sci-fi/${featured.slug}`} className="after:absolute after:inset-0">
              {featured.title}
            </Link>
          </h2>
          {featured.synopsis && <p className="max-w-md text-muted">{featured.synopsis}</p>}
          <p className="font-mono text-[10px] uppercase tracking-[0.2em]">By {featured.authorName}</p>
        </div>
      </article>
      {rest.length > 0 && (
        <section aria-labelledby="library">
          <h2 id="library" className="mb-6 font-mono text-[11px] uppercase tracking-[0.2em]">Library</h2>
          <ul className="grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
            {rest.map((s) => (
              <li key={s.slug}>
                <article className="group relative flex flex-col gap-3">
                  <SiteImage media={s.cover} label="Story cover" ratio="3/2" sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" />
                  <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">{dateFmt.format(s.date)}</p>
                  <h3 className="font-display text-lg uppercase tracking-[0.06em]">
                    <Link href={`/sci-fi/${s.slug}`} className="after:absolute after:inset-0">{s.title}</Link>
                  </h3>
                  {s.synopsis && <p className="text-sm text-muted">{s.synopsis}</p>}
                </article>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
