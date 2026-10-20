import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { getDb } from "@/db/client";
import { SignalMark } from "@/components/graphics";
import { ArrowLeftIcon, ArrowRightIcon } from "@/components/icons";
import { SiteImage } from "@/components/storefront/site-image";
import { Eyebrow } from "@/components/ui/eyebrow";
import { getStoryBySlug } from "@/server/content/stories";

export async function generateMetadata({ params }: PageProps<"/sci-fi/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  await connection();
  const s = await getStoryBySlug(getDb(), slug);
  if (!s) return { title: "Story not found", robots: { index: false } };
  return {
    title: s.seoTitle ?? s.title,
    description: s.seoDescription ?? s.synopsis ?? undefined,
    alternates: { canonical: `/sci-fi/${s.slug}` },
    openGraph: { type: "article", title: s.title, images: s.cover ? [{ url: s.cover.src }] : undefined },
  };
}

const dateFmt = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });

export default function StoryPage({ params }: PageProps<"/sci-fi/[slug]">) {
  return (
    <Suspense fallback={<div className="min-h-[80svh]" aria-busy="true" />}>
      <Story params={params} />
    </Suspense>
  );
}

async function Story({ params }: Pick<PageProps<"/sci-fi/[slug]">, "params">) {
  const { slug } = await params;
  await connection();
  const s = await getStoryBySlug(getDb(), slug);
  if (!s) notFound();
  return (
    <>
      <article>
        <header className="mx-auto flex max-w-3xl flex-col gap-6 px-4 pb-10 pt-16 text-center sm:pt-24">
          <Eyebrow className="flex items-center justify-center gap-3">
            <SignalMark className="h-4 w-4" /> Acronos Sci-Fi
            {s.categories.length > 0 && <> · {s.categories.map((c) => c.name).join(", ")}</>}
          </Eyebrow>
          <h1 className="font-display text-3xl uppercase leading-tight tracking-[0.06em] sm:text-5xl">{s.title}</h1>
          {s.synopsis && <p className="mx-auto max-w-xl text-lg text-ink/75">{s.synopsis}</p>}
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
            {s.authorName} · <time dateTime={s.date.toISOString()}>{dateFmt.format(s.date)}</time> · {s.readingMinutes} min read
          </p>
        </header>
        {s.cover && (
          <div className="mx-auto max-w-5xl px-4">
            <SiteImage media={s.cover} label="" ratio="2/1" priority sizes="(min-width: 1024px) 1024px, 100vw" />
          </div>
        )}
        <div
          className="mx-auto max-w-[68ch] px-4 py-16 text-[19px] leading-[1.75] text-ink/90 [&_a]:underline [&_blockquote]:border-l [&_blockquote]:border-line [&_blockquote]:pl-5 [&_blockquote]:italic [&_h2]:mt-12 [&_h2]:font-display [&_h2]:text-xl [&_h2]:uppercase [&_h3]:mt-10 [&_h3]:font-semibold [&_hr]:my-12 [&_hr]:border-line [&_li]:ml-6 [&_ol]:list-decimal [&_p+p]:mt-7 [&_ul]:list-disc"
          // Story HTML is sanitized on the server (server/content/stories.ts) before it reaches this page.
          dangerouslySetInnerHTML={{ __html: s.bodyHtml }}
        />
      </article>
      <nav aria-label="More stories" className="mx-auto grid max-w-5xl grid-cols-2 border-t border-line px-4">
        {s.previous ? (
          <Link href={`/sci-fi/${s.previous.slug}`} className="flex flex-col gap-2 py-8 pr-4 hover:text-muted">
            <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
              <ArrowLeftIcon width={14} /> Previous
            </span>
            <span className="font-display text-sm uppercase tracking-[0.08em] sm:text-base">{s.previous.title}</span>
          </Link>
        ) : (
          <span />
        )}
        {s.next ? (
          <Link href={`/sci-fi/${s.next.slug}`} className="flex flex-col items-end gap-2 border-l border-line py-8 pl-4 text-right hover:text-muted">
            <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
              Next <ArrowRightIcon width={14} />
            </span>
            <span className="font-display text-sm uppercase tracking-[0.08em] sm:text-base">{s.next.title}</span>
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </>
  );
}
