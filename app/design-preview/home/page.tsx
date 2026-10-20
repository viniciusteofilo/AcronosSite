import type { Metadata } from "next";
import { AngleRule, Crosshair, Globe, Hatch, HazardStripe } from "@/components/graphics";
import { ArrowLeftIcon, ArrowRightIcon } from "@/components/icons";
import { ProductCard } from "@/components/storefront/product-card";
import { SiteFooter } from "@/components/storefront/site-footer";
import { SiteHeader } from "@/components/storefront/site-header";
import { ButtonLink } from "@/components/ui/button";
import { Eyebrow, SectionTitle } from "@/components/ui/eyebrow";
import { MediaSlot } from "@/components/ui/media-slot";
import { PREVIEW_NAV, SAMPLE_PRODUCTS } from "../samples";

export const metadata: Metadata = { title: "Home" };

export default function HomePreview() {
  return (
    <>
      <div className="relative">
        <SiteHeader links={PREVIEW_NAV} current="Home" overlay />
        <Hero />
      </div>
      <main id="main">
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
    <section aria-labelledby="hero-title" className="relative min-h-[92svh] overflow-hidden">
      <MediaSlot label="Hero editorial photo · 2880×1800" fill />
      <div className="absolute inset-0 bg-gradient-to-r from-void/85 via-void/40 to-transparent" />
      <div className="relative mx-auto flex min-h-[92svh] max-w-[1440px] flex-col justify-end gap-10 px-4 pb-14 pt-28 sm:px-8 lg:justify-center lg:pb-24">
        <div className="flex max-w-2xl flex-col gap-6">
          <p aria-hidden className="font-display text-[11vw] font-semibold uppercase leading-none tracking-[0.14em] sm:text-7xl sm:tracking-[0.18em] lg:text-8xl">
            Acronos
          </p>
          <h1 id="hero-title" className="font-mono text-sm uppercase leading-relaxed tracking-[0.3em] text-snow/90 sm:text-base">
            Future observed
            <br />
            from everyday chaos.
          </h1>
          <ul className="flex flex-wrap gap-x-5 gap-y-1 font-mono text-[10px] uppercase tracking-[0.22em] text-steel">
            <li>Techwear</li>
            <li>Streetwear</li>
            <li>Design</li>
            <li>Innovation</li>
            <li>Purpose</li>
          </ul>
          <div>
            <ButtonLink href="/design-preview/collections">Explore collections</ButtonLink>
          </div>
        </div>
        <div className="flex items-end justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-steel">
          <p>
            ACN // 2018
            <br />
            Global uniform for a changing world
          </p>
          <p className="hidden items-center gap-3 sm:flex">
            <span>Scroll</span>
            <span aria-hidden className="h-8 w-px bg-steel/60" />
          </p>
        </div>
      </div>
      <Crosshair className="pointer-events-none absolute right-8 top-28 hidden h-10 w-10 text-snow/40 lg:block" />
    </section>
  );
}

function FeaturedCollection() {
  return (
    <section aria-labelledby="featured-collection" className="mx-auto grid max-w-[1440px] gap-0 px-4 py-20 sm:px-8 lg:grid-cols-2 lg:py-28">
      <MediaSlot label="Collection campaign · 2000×1500" ratio="4/3" />
      <div className="relative flex flex-col justify-center gap-6 border border-concrete bg-carbon p-8 sm:p-12 lg:border-l-0">
        <Eyebrow>01 // Featured collection</Eyebrow>
        <SectionTitle className="max-w-md" as="h2">
          <span id="featured-collection">Collection name</span>
        </SectionTitle>
        <p className="max-w-md text-steel">
          Short collection statement, two or three lines, written by ACRONOS. The concept, the materials and the
          city that shaped it.
        </p>
        <div>
          <ButtonLink href="/design-preview/collections" variant="secondary">
            Discover collection
          </ButtonLink>
        </div>
        <Hatch className="absolute bottom-8 right-8 h-8 w-8 text-concrete" />
      </div>
    </section>
  );
}

function FeaturedProducts() {
  return (
    <section aria-labelledby="featured-products" className="bg-snow text-void">
      <div className="mx-auto max-w-[1440px] px-4 py-20 sm:px-8 lg:py-24">
        <div className="mb-10 flex items-end justify-between gap-6">
          <div className="flex flex-col gap-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-void/50">02 // Selected</p>
            <h2 id="featured-products" className="font-display text-2xl uppercase tracking-[0.08em] sm:text-3xl">
              Featured products
            </h2>
          </div>
          <div className="hidden gap-2 sm:flex" aria-hidden>
            <span className="flex h-10 w-10 items-center justify-center border border-void/20"><ArrowLeftIcon width={16} /></span>
            <span className="flex h-10 w-10 items-center justify-center border border-void/20"><ArrowRightIcon width={16} /></span>
          </div>
        </div>
        <ul className="grid grid-cols-2 gap-x-4 gap-y-10 lg:grid-cols-4 [&_p]:text-void/60 [&_h3]:text-void">
          {SAMPLE_PRODUCTS.slice(0, 4).map((p) => (
            <li key={p.code}>
              <ProductCard product={p} />
            </li>
          ))}
        </ul>
        <div className="mt-12 flex justify-center">
          <ButtonLink href="/design-preview/shop" variant="inverse">
            Shop all
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}

function Manifesto() {
  return (
    <section id="about" aria-labelledby="manifesto" className="relative overflow-hidden border-b border-concrete">
      <div className="mx-auto grid max-w-[1440px] gap-12 px-4 py-24 sm:px-8 lg:grid-cols-[1fr_1.4fr] lg:py-32">
        <div className="flex flex-col gap-6">
          <Eyebrow>03 // Manifesto</Eyebrow>
          <h2 id="manifesto" className="font-display text-3xl uppercase leading-tight tracking-[0.06em] sm:text-4xl">
            More than clothing.
            <br />
            A movement.
          </h2>
          <AngleRule className="h-5 w-40 text-steel" />
        </div>
        <div className="flex flex-col gap-10">
          <p className="max-w-2xl text-lg leading-relaxed text-snow/85 sm:text-xl">
            Founded in São Paulo in 2018, ACRONOS designs for the space between order and chaos — where
            technology, industrial design and street culture meet the everyday.
          </p>
          <dl className="grid grid-cols-2 gap-8 border-t border-concrete pt-8 sm:grid-cols-4">
            {[
              ["2018", "Founded"],
              ["São Paulo", "Origin"],
              ["Global", "Vision"],
              ["Future", "Purpose"],
            ].map(([v, k]) => (
              <div key={k} className="flex flex-col-reverse gap-2">
                <dt className="font-mono text-[10px] uppercase tracking-[0.2em] text-steel">{k}</dt>
                <dd className="font-display text-lg uppercase tracking-[0.06em]">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-steel/70">Draft copy for review</p>
        </div>
      </div>
      <Globe className="pointer-events-none absolute -bottom-24 -right-24 h-80 w-80 text-concrete/60" />
    </section>
  );
}

function LabAndSciFi() {
  return (
    <section aria-label="Acronos Lab and Acronos Sci-Fi" className="grid lg:grid-cols-2">
      <article id="lab" className="relative min-h-[460px] overflow-hidden border-b border-concrete lg:border-b-0 lg:border-r">
        <MediaSlot label="Lab photo · 1600×1200" fill />
        <div className="absolute inset-0 bg-gradient-to-t from-void via-void/50 to-transparent" />
        <div className="relative flex h-full min-h-[460px] flex-col justify-end gap-5 p-8 sm:p-12">
          <Eyebrow>04 // Social project · in planning</Eyebrow>
          <h2 className="font-display text-2xl uppercase tracking-[0.08em] sm:text-3xl">Acronos Lab</h2>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-snow/80">Building futures.</p>
          <div>
            <ButtonLink href="/design-preview/home#lab" variant="secondary" size="sm">
              Discover Acronos Lab
            </ButtonLink>
          </div>
        </div>
        <HazardStripe className="absolute right-8 top-8 h-12 w-3 text-snow/50" />
      </article>
      <article className="relative min-h-[460px] overflow-hidden">
        <MediaSlot label="Sci-Fi artwork · 1600×1200" fill />
        <div aria-hidden className="absolute -right-16 top-12 h-72 w-72 rounded-full bg-[radial-gradient(circle_at_35%_35%,#8a8a8a,#2a2a2a_55%,#0f0f0f_75%)] opacity-70" />
        <div className="absolute inset-0 bg-gradient-to-t from-void via-void/50 to-transparent" />
        <div className="relative flex h-full min-h-[460px] flex-col justify-end gap-5 p-8 sm:p-12">
          <Eyebrow>05 // Original fiction</Eyebrow>
          <h2 className="font-display text-2xl uppercase tracking-[0.08em] sm:text-3xl">Acronos Sci-Fi</h2>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-snow/80">Stories of other tomorrows.</p>
          <div>
            <ButtonLink href="/design-preview/story" variant="secondary" size="sm">
              Explore stories
            </ButtonLink>
          </div>
        </div>
      </article>
    </section>
  );
}
