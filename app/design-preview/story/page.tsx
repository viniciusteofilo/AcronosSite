import type { Metadata } from "next";
import Link from "next/link";
import { SignalMark } from "@/components/graphics";
import { ArrowLeftIcon, ArrowRightIcon } from "@/components/icons";
import { SiteFooter } from "@/components/storefront/site-footer";
import { SiteHeader } from "@/components/storefront/site-header";
import { Eyebrow } from "@/components/ui/eyebrow";
import { MediaSlot } from "@/components/ui/media-slot";
import { PREVIEW_NAV } from "../samples";

export const metadata: Metadata = { title: "Sci-Fi story" };

/** Reading layout for ACRONOS SCI-FI. The text below is filler to preview typography, not a story. */
export default function StoryPreview() {
  return (
    <>
      <SiteHeader links={PREVIEW_NAV} current="Sci-Fi" />
      <main id="main">
        <article>
          <header className="mx-auto flex max-w-3xl flex-col gap-6 px-4 pb-10 pt-16 text-center sm:pt-24">
            <Eyebrow className="flex items-center justify-center gap-3">
              <SignalMark className="h-4 w-4" /> Acronos Sci-Fi · Category
            </Eyebrow>
            <h1 className="font-display text-3xl uppercase leading-tight tracking-[0.06em] sm:text-5xl">Story title</h1>
            <p className="mx-auto max-w-xl text-lg text-ink/75">
              One-sentence synopsis that sets the world and the question of the story.
            </p>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
              Author name · Publication date · 12 min read
            </p>
          </header>
          <div className="mx-auto max-w-5xl px-4">
            <MediaSlot label="Story cover · 2400×1200" ratio="2/1" />
          </div>
          <div className="mx-auto max-w-[68ch] px-4 py-16 text-[19px] leading-[1.75] text-ink/90 [&>p+p]:mt-7">
            <p>
              <span className="float-left mr-3 mt-1 font-display text-5xl leading-none">T</span>
              his paragraph is placeholder text set in the reading style for stories: Inter at nineteen pixels,
              generous line height and a column of about sixty-eight characters, which keeps long reading
              comfortable on a phone and on a wide screen.
            </p>
            <p>
              Dialogue, scene breaks and emphasis will follow the same rhythm. A dark reading mode is planned next
              to the light mode shown here; both keep contrast within accessibility guidelines.
            </p>
            <p className="py-4 text-center font-mono text-xs tracking-[0.5em] text-muted" aria-hidden>
              {"///"}
            </p>
            <p>
              Real stories will be written and published by ACRONOS from the editor in the admin panel, including
              drafts, scheduling and import of texts from the previous site. Nothing on this page is a published
              story.
            </p>
          </div>
        </article>
        <nav aria-label="More stories" className="mx-auto grid max-w-5xl grid-cols-2 border-t border-line px-4">
          <Link href="/design-preview/story" className="flex flex-col gap-2 py-8 pr-4 hover:text-muted">
            <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
              <ArrowLeftIcon width={14} /> Previous
            </span>
            <span className="font-display text-sm uppercase tracking-[0.08em] sm:text-base">Previous story title</span>
          </Link>
          <Link href="/design-preview/story" className="flex flex-col items-end gap-2 border-l border-line py-8 pl-4 text-right hover:text-muted">
            <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
              Next <ArrowRightIcon width={14} />
            </span>
            <span className="font-display text-sm uppercase tracking-[0.08em] sm:text-base">Next story title</span>
          </Link>
        </nav>
      </main>
      <SiteFooter />
    </>
  );
}
