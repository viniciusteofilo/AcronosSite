import Link from "next/link";
import { LogoLockup } from "@/components/brand/logo";
import { Crosshair } from "@/components/graphics";
import { Button } from "@/components/ui/button";
import { FOOTER_NAV } from "./nav";

/**
 * Footer with newsletter sign-up. The form is presentational in Phase 02; it is wired to
 * double opt-in (confirmation e-mail, consent record) in Phase 03.
 */
export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-canvas">
      <div className="mx-auto grid max-w-[1440px] grid-cols-[minmax(0,1fr)] gap-12 px-4 py-16 sm:px-8 lg:grid-cols-[1.2fr_2fr]">
        <div className="flex flex-col gap-6">
          <LogoLockup className="w-56" />
          <form className="flex max-w-sm flex-col gap-3" aria-label="Newsletter">
            <label htmlFor="footer-email" className="text-sm text-ink/90">
              Releases, stories and Lab updates. No spam.
            </label>
            <div className="flex">
              <input
                id="footer-email"
                type="email"
                autoComplete="email"
                placeholder="Email address"
                className="h-12 min-w-0 flex-1 border border-r-0 border-line bg-surface px-4 text-sm placeholder:text-muted/60"
              />
              <Button type="button" className="shrink-0">Subscribe</Button>
            </div>
            <p className="text-xs text-muted">
              By subscribing you agree to receive e-mails from ACRONOS. Unsubscribe anytime.
            </p>
          </form>
        </div>
        <div className="grid grid-cols-2 gap-10 sm:grid-cols-3">
          {FOOTER_NAV.map((group) => (
            <nav key={group.title} aria-label={group.title}>
              <p className="mb-4 font-mono text-[10px] uppercase tracking-[0.2em] text-muted">{group.title}</p>
              <ul className="flex flex-col gap-3 text-sm">
                {group.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="text-ink/80 hover:text-ink">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
      </div>
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-4 border-t border-line px-4 py-6 font-mono text-[10px] uppercase tracking-[0.18em] text-muted sm:px-8">
        <span>© {2026} ACRONOS · São Paulo, Brasil</span>
        <Crosshair className="h-5 w-5 text-line" />
        <span>ACN // EST. 2018</span>
      </div>
    </footer>
  );
}
