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
import { Wordmark } from "@/components/brand/wordmark";
import { ProductCard } from "@/components/storefront/product-card";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/eyebrow";
import { Checkbox, Field } from "@/components/ui/field";
import { ColorSelector, QuantityStepper, SizeSelector } from "@/components/ui/selectors";
import { SAMPLE_COLORS, SAMPLE_PRODUCTS, SAMPLE_SIZES } from "./samples";

export const metadata: Metadata = { title: "Style guide" };

const COLORS = [
  { name: "Void", hex: "#000000", use: "Main background", cls: "bg-void" },
  { name: "Carbon", hex: "#0F0F0F", use: "Surfaces, header, cards", cls: "bg-carbon" },
  { name: "Concrete", hex: "#2A2A2A", use: "Borders, dividers, fields", cls: "bg-concrete" },
  { name: "Steel", hex: "#A8A8A8", use: "Secondary text, icons", cls: "bg-steel" },
  { name: "Snow", hex: "#F5F5F5", use: "Main text, product ground", cls: "bg-snow" },
  { name: "Signal", hex: "#00DFFF", use: "Focus, active state — sparingly", cls: "bg-signal" },
  { name: "Alert", hex: "#FF2A2A", use: "Errors, sold out, destructive", cls: "bg-alert" },
];

function Block({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-8 border-t border-concrete py-14 lg:grid-cols-[240px_1fr]">
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
        <Wordmark className="text-3xl" />
        <h1 className="font-mono text-xs uppercase tracking-[0.3em] text-steel">Design system · v0.1 · for approval</h1>
      </header>

      <Block n="01" title="Color">
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
          {COLORS.map((c) => (
            <li key={c.name} className="flex flex-col gap-3">
              <span className={`block aspect-square border border-concrete ${c.cls}`} />
              <span className="font-mono text-[11px] uppercase tracking-[0.14em]">{c.name}</span>
              <span className="font-mono text-[10px] text-steel">{c.hex}</span>
              <span className="text-xs text-steel">{c.use}</span>
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
        <p className="mt-6 text-xs text-steel">Sold-out options stay visible, crossed out, and are announced as “sold out” to screen readers.</p>
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
          <ul className="flex flex-wrap gap-6 text-snow">
            {Object.entries(Icons).map(([name, Icon]) => (
              <li key={name} className="flex flex-col items-center gap-2">
                <Icon width={24} height={24} />
                <span className="font-mono text-[9px] uppercase text-steel">{name.replace("Icon", "")}</span>
              </li>
            ))}
          </ul>
          <ul className="flex flex-wrap items-center gap-10 text-snow">
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
        <ul className="flex flex-col gap-2 text-sm text-steel">
          <li>Spacing scale of 4 px: 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 · 96 · 128.</li>
          <li>12-column grid on desktop, max width 1440 px; 16 px side gutter on mobile.</li>
          <li>Square corners (0–2 px). Transitions 150–250 ms, switched off with “reduce motion”.</li>
          <li>Keyboard focus is always visible as a cyan outline.</li>
        </ul>
      </Block>
    </main>
  );
}
