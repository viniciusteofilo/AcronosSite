import type { Metadata } from "next";
import {
  AngleRule,
  CornerBrackets,
  Crosshair,
  Globe,
  Hatch,
  HazardStripe,
  SignalMark,
} from "@/components/graphics";
import * as Icons from "@/components/icons";
import { LogoLockup, LogoSymbol, LogoWordmark } from "@/components/brand/logo";
import { ProductCard } from "@/components/storefront/product-card";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/eyebrow";
import { Checkbox, Field } from "@/components/ui/field";
import { ColorSelector, QuantityStepper, SizeSelector } from "@/components/ui/selectors";
import { SAMPLE_COLORS, SAMPLE_PRODUCTS, SAMPLE_SIZES } from "./samples";

export const metadata: Metadata = { title: "Style guide" };

const COLORS = [
  { name: "Canvas", hex: "#ECECE9", use: "Page background (light gray)", cls: "bg-canvas" },
  { name: "Surface", hex: "#F7F7F5", use: "Cards, header, fields", cls: "bg-surface" },
  { name: "Paper", hex: "#FFFFFF", use: "Menus, drawers", cls: "bg-paper" },
  { name: "Line", hex: "#CFCFCB", use: "Dividers, outlines", cls: "bg-line" },
  { name: "Muted", hex: "#5A5A57", use: "Secondary text, icons", cls: "bg-muted" },
  { name: "Ink", hex: "#111111", use: "Main text, primary buttons", cls: "bg-ink" },
  { name: "Signal", hex: "#00849E", use: "Focus, active state — sparingly", cls: "bg-signal" },
  { name: "Alert", hex: "#C4231B", use: "Errors, sold out, destructive", cls: "bg-alert" },
];

function Block({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-8 border-t border-line py-14 lg:grid-cols-[240px_1fr]">
      <div className="flex flex-col gap-2">
        <Eyebrow>{n}</Eyebrow>
        <h2 className="font-display text-lg uppercase tracking-[0.1em]">{title}</h2>
      </div>
      <div>{children}</div>
    </section>
  );
}

export default function StyleGuide() {
  return (
    <main id="main" className="mx-auto w-full max-w-[1440px] px-4 py-16 sm:px-8">
      <header className="flex flex-col gap-6 pb-14">
        <LogoWordmark className="h-8 w-auto" />
        <h1 className="font-mono text-xs uppercase tracking-[0.3em] text-muted">Design system · v0.2 light · for approval</h1>
      </header>

      <Block n="00" title="Logo">
        <div className="flex flex-col gap-8">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex aspect-[4/3] items-center justify-center border border-line bg-surface p-8">
              <LogoLockup className="w-full max-w-[220px]" />
            </div>
            <div className="flex aspect-[4/3] items-center justify-center bg-ink p-8 text-canvas">
              <LogoLockup className="w-full max-w-[220px]" />
            </div>
            <div className="flex aspect-[4/3] items-center justify-center gap-4 border border-line bg-surface p-8">
              <LogoSymbol className="h-10 w-auto" />
              <LogoWordmark className="h-5 w-auto" />
            </div>
          </div>
          <p className="max-w-2xl text-sm text-muted">
            Traced as vector from the artwork supplied on 2026-10-20, without redrawing. The ® mark is left out
            until the trademark registration is confirmed. Swap in the original SVG/PDF files when available.
          </p>
        </div>
      </Block>

      <Block n="01" title="Color">
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
          {COLORS.map((c) => (
            <li key={c.name} className="flex flex-col gap-3">
              <span className={`block aspect-square border border-line ${c.cls}`} />
              <span className="font-mono text-[11px] uppercase tracking-[0.14em]">{c.name}</span>
              <span className="font-mono text-[10px] text-muted">{c.hex}</span>
              <span className="text-xs text-muted">{c.use}</span>
            </li>
          ))}
        </ul>
      </Block>

      <Block n="02" title="Typography">
        <div className="flex flex-col gap-10">
          <div className="flex flex-col gap-2">
            <Eyebrow>Orbitron · display, titles</Eyebrow>
            <p className="font-display text-4xl uppercase tracking-[0.08em] sm:text-6xl">Future observed</p>
          </div>
          <div className="flex flex-col gap-2">
            <Eyebrow>Inter · interface and reading</Eyebrow>
            <p className="max-w-2xl text-lg leading-relaxed">
              ACRONOS designs for the space between order and chaos. Body text is set in Inter at 16–19 px with a
              comfortable line height.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <Eyebrow>Space Mono · codes, labels, prices</Eyebrow>
            <p className="font-mono text-sm uppercase tracking-[0.18em]">ACN-JK-000 · $000.00 · 001 // Drop</p>
          </div>
        </div>
      </Block>

      <Block n="03" title="Buttons">
        <div className="flex flex-wrap items-center gap-4">
          <ButtonLink href="#">Explore collections</ButtonLink>
          <ButtonLink href="#" variant="secondary">Discover collection</ButtonLink>
          <Button>Add to cart</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Delete</Button>
          <Button disabled>Disabled</Button>
          <Button size="sm" variant="secondary">Small</Button>
        </div>
      </Block>

      <Block n="04" title="Forms">
        <div className="grid max-w-3xl gap-8 sm:grid-cols-2">
          <Field id="sg-email" label="Email" type="email" placeholder="you@example.com" hint="We'll send your order confirmation here." />
          <Field id="sg-zip" label="ZIP code" defaultValue="0000" error="Enter a valid 5-digit ZIP code." />
          <div className="flex flex-col gap-3">
            <Checkbox id="sg-c1" label="Save this address" defaultChecked />
            <Checkbox id="sg-c2" label="Send me releases and stories" />
          </div>
          <QuantityStepper />
        </div>
      </Block>

      <Block n="05" title="Variant pickers">
        <div className="grid max-w-3xl gap-10 sm:grid-cols-2">
          <ColorSelector name="sg-color" options={SAMPLE_COLORS} defaultValue="graphite" />
          <SizeSelector name="sg-size" options={SAMPLE_SIZES} defaultValue="m" />
        </div>
        <p className="mt-6 text-xs text-muted">Sold-out options stay visible, crossed out, and are announced as “sold out” to screen readers.</p>
      </Block>

      <Block n="06" title="Status">
        <div className="flex flex-wrap gap-3">
          <Badge>Draft</Badge>
          <Badge tone="inverse">New</Badge>
          <Badge tone="signal">Shipped</Badge>
          <Badge tone="alert">Sold out</Badge>
          <Badge tone="neutral">In development</Badge>
        </div>
      </Block>

      <Block n="07" title="Product card">
        <ul className="grid max-w-3xl grid-cols-2 gap-4 sm:grid-cols-3">
          {SAMPLE_PRODUCTS.slice(0, 3).map((p) => (
            <li key={p.code}>
              <ProductCard product={p} />
            </li>
          ))}
        </ul>
      </Block>

      <Block n="08" title="Icons & graphic elements">
        <div className="flex flex-col gap-10">
          <ul className="flex flex-wrap gap-6 text-ink">
            {Object.entries(Icons).map(([name, Icon]) => (
              <li key={name} className="flex flex-col items-center gap-2">
                <Icon width={24} height={24} />
                <span className="font-mono text-[9px] uppercase text-muted">{name.replace("Icon", "")}</span>
              </li>
            ))}
          </ul>
          <ul className="flex flex-wrap items-center gap-10 text-ink">
            <li><Crosshair className="h-12 w-12" /></li>
            <li><Hatch className="h-12 w-12" /></li>
            <li><Globe className="h-12 w-12" /></li>
            <li><SignalMark className="h-12 w-12" /></li>
            <li><CornerBrackets className="h-12 w-12" /></li>
            <li><HazardStripe className="h-12 w-3" /></li>
            <li><AngleRule className="h-6 w-32" /></li>
          </ul>
        </div>
      </Block>

      <Block n="09" title="Spacing & motion">
        <ul className="flex flex-col gap-2 text-sm text-muted">
          <li>Spacing scale of 4 px: 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 · 96 · 128.</li>
          <li>12-column grid on desktop, max width 1440 px; 16 px side gutter on mobile.</li>
          <li>Square corners (0–2 px). Transitions 150–250 ms, switched off with “reduce motion”.</li>
          <li>Keyboard focus is always visible as a cyan outline.</li>
        </ul>
      </Block>
    </main>
  );
}
