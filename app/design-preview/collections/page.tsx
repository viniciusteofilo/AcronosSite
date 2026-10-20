import type { Metadata } from "next";
import Link from "next/link";
import { CornerBrackets } from "@/components/graphics";
import { ArrowRightIcon } from "@/components/icons";
import { SiteFooter } from "@/components/storefront/site-footer";
import { SiteHeader } from "@/components/storefront/site-header";
import { Badge } from "@/components/ui/badge";
import { Eyebrow } from "@/components/ui/eyebrow";
import { MediaSlot } from "@/components/ui/media-slot";
import { PREVIEW_NAV } from "../samples";

export const metadata: Metadata = { title: "Collections" };

const COLLECTIONS = [
  { code: "001", name: "Collection name", line: "Collection statement in one or two lines.", status: "Current" },
  { code: "002", name: "Collection name", line: "Collection statement in one or two lines.", status: "In development" },
  { code: "003", name: "Collection name", line: "Collection statement in one or two lines.", status: null },
  { code: "ARC", name: "Archive", line: "Previous collections.", status: null },
];

export default function CollectionsPreview() {
  return (
    <>
      <SiteHeader links={PREVIEW_NAV} current="Collections" />
      <main id="main" className="mx-auto w-full max-w-[1440px] px-4 pb-24 sm:px-8">
        <header className="grid gap-6 border-b border-line py-14 lg:grid-cols-[1fr_auto] lg:items-end lg:py-20">
          <div className="flex flex-col gap-4">
            <Eyebrow>Collections //</Eyebrow>
            <h1 className="font-display text-4xl uppercase tracking-[0.1em] sm:text-6xl">Collections</h1>
            <p className="max-w-md text-muted">Exploring new territories of tomorrow.</p>
          </div>
          <CornerBrackets className="hidden h-12 w-12 text-ink/30 lg:block" />
        </header>

        <ul className="flex flex-col">
          {COLLECTIONS.map((c, i) => (
            <li key={c.code} className="border-b border-line py-8 lg:py-12">
              <article className="group relative grid items-center gap-6 lg:grid-cols-2 lg:gap-14">
                <div className={i % 2 === 1 ? "lg:order-2" : undefined}>
                  <MediaSlot
                    label="Collection banner · 2400×1350"
                    ratio="16/9"
                    className="transition-transform duration-700 group-hover:scale-[1.01]"
                  />
                </div>
                <div className="flex flex-col gap-4">
                  <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted">{`${c.code} //`}</p>
                  <h2 className="font-display text-2xl uppercase tracking-[0.08em] sm:text-4xl">
                    <Link href="/design-preview/shop" className="after:absolute after:inset-0">
                      {c.name}
                    </Link>
                  </h2>
                  <p className="max-w-md text-muted">{c.line}</p>
                  <div className="flex items-center gap-4 pt-2">
                    {c.status && <Badge tone={c.status === "Current" ? "inverse" : "neutral"}>{c.status}</Badge>}
                    <span aria-hidden className="flex h-11 w-11 items-center justify-center border border-ink/30 transition-colors group-hover:bg-ink group-hover:text-canvas">
                      <ArrowRightIcon />
                    </span>
                  </div>
                </div>
              </article>
            </li>
          ))}
        </ul>
      </main>
      <SiteFooter />
    </>
  );
}
