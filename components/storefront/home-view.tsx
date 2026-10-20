import { LogoWordmark } from "@/components/brand/logo";
import { AngleRule, Crosshair, Globe, Hatch, HazardStripe, SignalMark } from "@/components/graphics";
import { ButtonLink } from "@/components/ui/button";
import { Eyebrow, SectionTitle } from "@/components/ui/eyebrow";
import type { HomeBlocks } from "@/server/content/home";
import type { MediaView } from "@/server/media/library";
import { ProductCard, type ProductCardData } from "./product-card";
import { SiteImage } from "./site-image";

/**
 * The homepage, drawn only from editable content (HomeBlocks) and catalog data.
 * Used by the live site and by the admin preview, so what the editor previews is exactly
 * what visitors get. Text never sits on top of photos: any campaign image keeps it readable.
 */
export function HomeView({
  blocks,
  media,
  products,
}: {
  blocks: HomeBlocks;
  media: Map<string, MediaView>;
  products: ProductCardData[];
}) {
  const img = (id: string | null) => (id ? (media.get(id) ?? null) : null);
  const { hero, featuredCollection: fc, featuredProducts: fp, manifesto, lab, scifi } = blocks;
  const tags = hero.tags.split(/[·,]/).map((t) => t.trim()).filter(Boolean);
  const [headA, ...headB] = hero.headline.split(" from ");

  return (
    <>
      <section aria-labelledby="hero-title" className="relative overflow-hidden border-b border-line">
        <div className="mx-auto grid max-w-[1440px] gap-10 px-4 pb-12 pt-10 sm:px-8 lg:grid-cols-[1.05fr_1fr] lg:gap-0 lg:pb-0 lg:pt-0">
          <div className="relative flex flex-col justify-between gap-12 lg:py-20 lg:pr-14">
            <div className="flex flex-col gap-7">
              {hero.eyebrow && <Eyebrow>{hero.eyebrow}</Eyebrow>}
              <LogoWordmark className="h-auto w-full max-w-[560px]" />
              <h1 id="hero-title" className="font-mono text-sm uppercase leading-relaxed tracking-[0.3em] sm:text-base">
                {headB.length ? (
                  <>
                    {headA}
                    <br />
                    from {headB.join(" from ")}
                  </>
                ) : (
                  hero.headline
                )}
              </h1>
              {tags.length > 0 && (
                <ul className="flex flex-wrap gap-x-5 gap-y-1 font-mono text-[10px] uppercase tracking-[0.22em] text-muted">
                  {tags.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              )}
              <div className="flex flex-wrap gap-3">
                {hero.primary.label && <ButtonLink href={hero.primary.href}>{hero.primary.label}</ButtonLink>}
                {hero.secondary.label && (
                  <ButtonLink href={hero.secondary.href} variant="secondary">
                    {hero.secondary.label}
                  </ButtonLink>
                )}
              </div>
            </div>
            <div className="flex items-end justify-between gap-6 border-t border-line pt-5 font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
              <p>{hero.footnote}</p>
              <Crosshair className="h-6 w-6 shrink-0 text-ink/50" />
            </div>
          </div>
          <div className="relative min-h-[420px] lg:min-h-[640px]">
            <SiteImage media={img(hero.imageId)} label="Hero editorial photo · 1800×2200" fill priority sizes="(min-width: 1024px) 50vw, 100vw" />
          </div>
        </div>
      </section>

      <section aria-labelledby="featured-collection" className="mx-auto grid max-w-[1440px] px-4 py-20 sm:px-8 lg:grid-cols-[1.3fr_1fr] lg:py-28">
        <SiteImage media={img(fc.imageId)} label="Collection campaign · 2000×1500" ratio="4/3" sizes="(min-width: 1024px) 56vw, 100vw" />
        <div className="relative flex flex-col justify-center gap-6 border border-line bg-surface p-8 sm:p-12 lg:border-l-0">
          {fc.eyebrow && <Eyebrow>{fc.eyebrow}</Eyebrow>}
          <SectionTitle className="max-w-md">
            <span id="featured-collection">{fc.title}</span>
          </SectionTitle>
          {fc.text && <p className="max-w-md whitespace-pre-line text-muted">{fc.text}</p>}
          {fc.cta.label && (
            <div>
              <ButtonLink href={fc.cta.href} variant="secondary">
                {fc.cta.label}
              </ButtonLink>
            </div>
          )}
          <Hatch className="absolute bottom-8 right-8 h-8 w-8 text-line" />
        </div>
      </section>

      <section aria-labelledby="featured-products" className="border-y border-line bg-surface">
        <div className="mx-auto max-w-[1440px] px-4 py-20 sm:px-8 lg:py-24">
          <div className="mb-10 flex flex-col gap-3">
            {fp.eyebrow && <Eyebrow>{fp.eyebrow}</Eyebrow>}
            <h2 id="featured-products" className="font-display text-2xl uppercase tracking-[0.08em] sm:text-3xl">
              {fp.title}
            </h2>
          </div>
          {products.length > 0 ? (
            <ul className="grid grid-cols-2 gap-x-4 gap-y-10 lg:grid-cols-4">
              {products.map((p) => (
                <li key={p.href}>
                  <ProductCard product={p} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="border border-dashed border-line px-6 py-12 text-center font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
              New products are coming soon.
            </p>
          )}
          <div className="mt-12 flex justify-center">
            <ButtonLink href="/shop">Shop all</ButtonLink>
          </div>
        </div>
      </section>

      <section id="about" aria-labelledby="manifesto" className="relative overflow-hidden">
        <div className="mx-auto grid max-w-[1440px] gap-12 px-4 py-24 sm:px-8 lg:grid-cols-[1fr_1.4fr] lg:py-32">
          <div className="flex flex-col gap-6">
            {manifesto.eyebrow && <Eyebrow>{manifesto.eyebrow}</Eyebrow>}
            <h2 id="manifesto" className="max-w-md font-display text-3xl uppercase leading-tight tracking-[0.06em] sm:text-4xl">
              {manifesto.title}
            </h2>
            <AngleRule className="h-5 w-40 text-muted" />
          </div>
          <div className="relative flex flex-col gap-10">
            <p className="max-w-2xl whitespace-pre-line text-lg leading-relaxed text-ink/85 sm:text-xl">{manifesto.text}</p>
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
          </div>
        </div>
        <Globe className="pointer-events-none absolute -bottom-24 -right-24 h-80 w-80 text-line" />
      </section>

      <section aria-label={`${lab.title} and ${scifi.title}`} className="border-t border-line">
        <div className="mx-auto grid max-w-[1440px] gap-4 px-4 py-20 sm:px-8 lg:grid-cols-2 lg:py-24">
          {[
            { id: "lab", b: lab, label: "Lab photo · 1600×1000", mark: <HazardStripe className="h-10 w-3 text-ink/40" /> },
            { id: "scifi", b: scifi, label: "Sci-Fi artwork · 1600×1000", mark: <SignalMark className="h-8 w-8 text-ink/40" /> },
          ].map(({ id, b, label, mark }) => (
            <article key={id} className="flex flex-col border border-line bg-surface">
              <SiteImage media={img(b.imageId)} label={label} ratio="16/10" sizes="(min-width: 1024px) 50vw, 100vw" />
              <div className="flex flex-1 flex-col gap-4 p-8 sm:p-10">
                <div className="flex items-start justify-between gap-6">
                  {b.eyebrow ? <Eyebrow>{b.eyebrow}</Eyebrow> : <span />}
                  {mark}
                </div>
                <h2 className="font-display text-2xl uppercase tracking-[0.08em] sm:text-3xl">{b.title}</h2>
                {b.line && <p className="font-mono text-xs uppercase tracking-[0.2em]">{b.line}</p>}
                {b.text && <p className="max-w-md text-muted">{b.text}</p>}
                {b.cta.label && (
                  <div className="mt-auto pt-4">
                    <ButtonLink href={b.cta.href} variant="secondary" size="sm">
                      {b.cta.label}
                    </ButtonLink>
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
