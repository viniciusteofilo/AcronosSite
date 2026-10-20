import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

export const metadata: Metadata = {
  title: { default: "Design preview", template: "%s · Design preview · ACRONOS" },
  robots: { index: false, follow: false },
};

const PAGES = [
  { label: "Style guide", href: "/design-preview" },
  { label: "Home", href: "/design-preview/home" },
  { label: "Shop", href: "/design-preview/shop" },
  { label: "Product", href: "/design-preview/product" },
  { label: "Collections", href: "/design-preview/collections" },
  { label: "Sci-Fi story", href: "/design-preview/story" },
];

/**
 * Phase 02 approval screens. Disabled in production unless DESIGN_PREVIEW=1, never indexed.
 * Every image and product here is a labeled placeholder, not real content.
 */
export default function DesignPreviewLayout({ children }: LayoutProps<"/design-preview">) {
  if (process.env.NODE_ENV === "production" && process.env.DESIGN_PREVIEW !== "1") notFound();
  return (
    <>
      <div className="relative z-50 border-b border-signal/40 bg-carbon">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-2 sm:px-8">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-signal">
            Design preview · images and products are placeholders
          </p>
          <nav aria-label="Preview pages">
            <ul className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px] uppercase tracking-[0.14em] text-steel">
              {PAGES.map((p) => (
                <li key={p.href}>
                  <Link href={p.href} className="hover:text-snow">
                    {p.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>
      {children}
    </>
  );
}
