import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRightIcon } from "@/components/icons";
import { SiteFooter } from "@/components/storefront/site-footer";
import { SiteHeader } from "@/components/storefront/site-header";
import { Badge } from "@/components/ui/badge";
import { Eyebrow } from "@/components/ui/eyebrow";
import { MediaSlot } from "@/components/ui/media-slot";
import { PREVIEW_NAV } from "../samples";

export const metadata: Metadata = { title: "Collections" };

const COLLECTIONS = [
  { code: "001", name: "Collection name", line: "Collection statement in one line.", status: "Current" },
  { code: "002", name: "Collection name", line: "Collection statement in one line.", status: "In development" },
  { code: "003", name: "Collection name", line: "Collection statement in one line.", status: null },
  { code: "ARC", name: "Archive", line: "Previous collections.", status: null },
];

export default function CollectionsPreview() {
  return (
    <>
      <div className="relative">
        <SiteHeader links={PREVIEW_NAV} current="Collections" overlay />
        <section aria-labelledby="collections-title" className="relative min-h-[70svh] overflow-hidden">
          <MediaSlot label="Collections hero · 2880×1600" fill />
          <div className="absolute inset-0 bg-gradient-to-t from-void via-void/40 to-transparent" />
          <div className="relative mx-auto flex min-h-[70svh] max-w-[1440px] flex-col justify-end gap-4 px-4 pb-14 sm:px-8">
            <Eyebrow>Collections //</Eyebrow>
            <h1 id="collections-title" className="font-display text-4xl uppercase tracking-[0.1em] sm:text-6xl">
              Collections
            </h1>
            <p className="max-w-md text-snow/80">Exploring new territories of tomorrow.</p>
          </div>
        </section>
      </div>
      <main id="main" className="mx-auto flex w-full max-w-[1440px] flex-col gap-2 px-4 py-16 sm:px-8">
        {COLLECTIONS.map((c) => (
          <article key={c.code} className="group relative min-h-[260px] overflow-hidden sm:min-h-[320px]">
            <MediaSlot label="Collection banner · 2880×1000" fill className="transition-transform duration-700 group-hover:scale-[1.02]" />
            <div className="absolute inset-0 bg-gradient-to-r from-void/90 via-void/50 to-transparent" />
            <div aria-hidden className="absolute inset-y-0 right-[18%] hidden w-px rotate-[24deg] bg-snow/15 sm:block" />
            <div className="relative flex h-full min-h-[260px] items-end justify-between gap-6 p-6 sm:min-h-[320px] sm:p-10">
              <div className="flex flex-col gap-3">
                <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-steel">{`${c.code} //`}</p>
                <h2 className="font-display text-2xl uppercase tracking-[0.08em] sm:text-4xl">
                  <Link href="/design-preview/shop" className="after:absolute after:inset-0">
                    {c.name}
                  </Link>
                </h2>
                <p className="text-sm text-snow/75">{c.line}</p>
                {c.status && (
                  <div>
                    <Badge tone={c.status === "Current" ? "inverse" : "neutral"}>{c.status}</Badge>
                  </div>
                )}
              </div>
              <span aria-hidden className="flex h-12 w-12 shrink-0 items-center justify-center border border-snow/40 transition-colors group-hover:bg-snow group-hover:text-void">
                <ArrowRightIcon />
              </span>
            </div>
          </article>
        ))}
      </main>
      <SiteFooter />
    </>
  );
}
