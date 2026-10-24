import type { Metadata } from "next";
import { AngleRule, Crosshair, Globe, Hatch, HazardStripe, SignalMark } from "@/components/graphics";
import { ArrowLeftIcon, ArrowRightIcon } from "@/components/icons";
import { ProductCard } from "@/components/storefront/product-card";
import { SiteFooter } from "@/components/storefront/site-footer";
import { SiteHeader } from "@/components/storefront/site-header";
import { LogoWordmark } from "@/components/brand/logo";
import { ButtonLink } from "@/components/ui/button";
import { Eyebrow, SectionTitle } from "@/components/ui/eyebrow";
import { MediaSlot } from "@/components/ui/media-slot";
import { PREVIEW_NAV, SAMPLE_PRODUCTS } from "../samples";

export const metadata: Metadata = { title: "Home" };

/*
 * Light editorial homepage. Text never sits on top of photos, so any image ACRONOS
 * supplies later keeps every line readable without retouching.
 */
export default function HomePreview() {
  return (
    <>
      <SiteHeader links={PREVIEW_NAV} current="Home" />
      <main id="main">
        <Hero />
        <FeaturedCollection />
        <FeaturedProducts />
        <Manifesto />
        <LabAndSciFi />
      </main>
      <SiteFooter />
    </>
  );
}

function Hero() {
  return (
    <section aria-labelledby="hero-title" className="relative overflow-hidden border-b border-line">
      <div className="mx-auto grid max-w-[1440px] gap-10 px-4 pb-12 pt-10 sm:px-8 lg:grid-cols-[1.05fr_1fr] lg:gap-0 lg:pb-0 lg:pt-0">
        <div className="relative flex flex-col justify-between gap-12 lg:py-20 lg:pr-14">
          <div className="flex flex-col gap-7">
            <Eyebrow>ACN // São Paulo · 2018</Eyebrow>
            <LogoWordmark className="h-auto w-full max-w-[560px]" />
            <h1 id="hero-title" className="font-mono text-sm uppercase leading-relaxed tracking-[0.3em] sm:text-base">
              Future observed
              <br />
              from everyday chaos.
            </h1>
            <ul className="flex flex-wrap gap-x-5 gap-y-1 font-mono text-[10px] uppercase tracking-[0.22em] text-muted">
              <li>Techwear</li>
              <li>Streetwear</li>
              <li>Design</li>
              <li>Innovation</li>
              <li>Purpose</li>
            </ul>
            <div className="flex flex-wrap gap-3">
              <ButtonLink href="/design-preview/collections">Explore collections</ButtonLink>
              <ButtonLink href="/design-preview/shop" variant="secondary">
                Shop now
              </ButtonLink>
            </div>
          </div>
          <div className="flex items-end justify-between gap-6 border-t border-line pt-5 font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
            <p>Global uniform for a changing world</p>
            <Crosshair className="h-6 w-6 shrink-0 text-ink/50" />
          </div>
        </div>
        <div className="relative min-h-[420px] lg:min-h-[640px]">
          <MediaSlot label="Hero editorial photo · 1800×2200" fill />
        </div>
      </div>
    </section>
  );
}

function FeaturedCollection() {
  return (
    <section aria-labelledby="featured-collection" className="mx-auto grid max-w-[1440px] px-4 py-20 sm:px-8 lg:grid-cols-[1.3fr_1fr] lg:py-28">
      <MediaSlot label="Collection campaign · 2000×1500" ratio="4/3" />
      <div className="relative flex flex-col justify-center gap-6 border border-line bg-surface p-8 sm:p-12 lg:border-l-0">
        <Eyebrow>01 // Featured collection</Eyebrow>
        <SectionTitle className="max-w-md">
          <span id="featured-collection">Collection name</span>
        </SectionTitle>
        <p className="max-w-md text-muted">
          Short collection statement, two or three lines, written by ACRONOS. The concept, the materials and the
          city that shaped it.
        </p>
        <div>
          <ButtonLink href="/design-preview/collections" variant="secondary">
            Discover collection
          </ButtonLink>
        </div>
        <Hatch className="absolute bottom-8 right-8 h-8 w-8 text-line" />
      </div>
    </section>
  );
}

function FeaturedProducts() {
  return (
    <section aria-labelledby="featured-products" className="border-y border-line bg-surface">
      <div className="mx-auto max-w-[1440px] px-4 py-20 sm:px-8 lg:py-24">
        <div className="mb-10 flex items-end justify-between gap-6">
          <div className="flex flex-col gap-3">
            <Eyebrow>02 // Selected</Eyebrow>
            <h2 id="featured-products" className="font-display text-2xl uppercase tracking-[0.08em] sm:text-3xl">
              Featured products
            </h2>
          </div>
          <div className="hidden gap-2 sm:flex" aria-hidden>
            <span className="flex h-10 w-10 items-center justify-center border border-line"><ArrowLeftIcon width={16} /></span>
            <span className="flex h-10 w-10 items-center justify-center border border-line"><ArrowRightIcon width={16} /></span>
          </div>
        </div>
        <ul className="grid grid-cols-2 gap-x-4 gap-y-10 lg:grid-cols-4">
          {SAMPLE_PRODUCTS.slice(0, 4).map((p) => (
            <li key={p.code}>
              <ProductCard product={p} />
            </li>
          ))}
        </ul>
        <div className="mt-12 flex justify-center">
          <ButtonLink href="/design-preview/shop">Shop all</ButtonLink>
        </div>
      </div>
    </section>
  );
}

function Manifesto() {
  return (
    <section id="about" aria-labelledby="manifesto" className="relative overflow-hidden">
      <div className="mx-auto grid max-w-[1440px] gap-12 px-4 py-24 sm:px-8 lg:grid-cols-[1fr_1.4fr] lg:py-32">
        <div className="flex flex-col gap-6">
          <Eyebrow>03 // Manifesto</Eyebrow>
          <h2 id="manifesto" className="font-display text-3xl uppercase leading-tight tracking-[0.06em] sm:text-4xl">
            More than clothing.
            <br />
            A movement.
          </h2>
          <AngleRule className="h-5 w-40 text-muted" />
        </div>
        <div className="relative flex flex-col gap-10">
          <p className="max-w-2xl text-lg leading-relaxed text-ink/85 sm:text-xl">
            Founded in São Paulo in 2018, ACRONOS designs for the space between order and chaos, where technology,
            industrial design and street culture meet the everyday.
          </p>
          <dl className="grid grid-cols-2 gap-8 border-t border-line pt-8 sm:grid-cols-4">
            {[
              ["2018", "Founded"],
              ["São Paulo", "Origin"],
              ["Global", "Vision"],
              ["Future", "Purpose"],
            ].map(([v, k]) => (
              <div key={k} className="flex flex-col-reverse gap-2">
                <dt className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">{k}</dt>
                <dd className="font-display text-lg uppercase tracking-[0.06em]">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">Draft copy for review</p>
        </div>
      </div>
      <Globe className="pointer-events-none absolute -bottom-24 -right-24 h-80 w-80 text-line" />
    </section>
  );
}

function LabAndSciFi() {
  const cards = [
    {
      id: "lab",
      eyebrow: "04 // Social project · in planning",
      title: "Acronos Lab",
      line: "Building futures.",
      text: "A project to open paths for young people in technology, design and innovation.",
      cta: "Discover Acronos Lab",
      href: "/design-preview/home#lab",
      image: "Lab photo · 1600×1000",
      mark: <HazardStripe className="h-10 w-3 text-ink/40" />,
    },
    {
      id: "scifi",
      eyebrow: "05 // Original fiction",
      title: "Acronos Sci-Fi",
      line: "Stories of other tomorrows.",
      text: "Original short stories about technology, humanity and the future.",
      cta: "Explore stories",
      href: "/design-preview/story",
      image: "Sci-Fi artwork · 1600×1000",
      mark: <SignalMark className="h-8 w-8 text-ink/40" />,
    },
  ];
  return (
    <section aria-label="Acronos Lab and Acronos Sci-Fi" className="border-t border-line">
      <div className="mx-auto grid max-w-[1440px] gap-4 px-4 py-20 sm:px-8 lg:grid-cols-2 lg:py-24">
        {cards.map((c) => (
          <article key={c.id} id={c.id} className="flex flex-col border border-line bg-surface">
            <MediaSlot label={c.image} ratio="16/10" />
            <div className="flex flex-1 flex-col gap-4 p-8 sm:p-10">
              <div className="flex items-start justify-between gap-6">
                <Eyebrow>{c.eyebrow}</Eyebrow>
                {c.mark}
              </div>
              <h2 className="font-display text-2xl uppercase tracking-[0.08em] sm:text-3xl">{c.title}</h2>
              <p className="font-mono text-xs uppercase tracking-[0.2em]">{c.line}</p>
              <p className="max-w-md text-muted">{c.text}</p>
              <div className="mt-auto pt-4">
                <ButtonLink href={c.href} variant="secondary" size="sm">
                  {c.cta}
                </ButtonLink>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
