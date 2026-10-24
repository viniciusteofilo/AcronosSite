import Link from "next/link";
import { LogoLockup } from "@/components/brand/logo";
import { Crosshair } from "@/components/graphics";
import type { FormResult } from "@/server/marketing/forms";
import { FOOTER_NAV } from "./nav";
import { NewsletterForm } from "./newsletter-form";

export function SiteFooter({
  newsletterAction,
}: {
  newsletterAction?: (prev: FormResult | null, form: FormData) => Promise<FormResult>;
}) {
  return (
    <footer className="border-t border-line bg-canvas">
      <div className="mx-auto grid max-w-[1440px] grid-cols-[minmax(0,1fr)] gap-12 px-4 py-16 sm:px-8 lg:grid-cols-[1.2fr_2fr]">
        <div className="flex flex-col gap-8">
          <LogoLockup className="w-56" />
          {newsletterAction ? (
            <NewsletterForm action={newsletterAction} />
          ) : (
            <p className="text-sm text-muted">Releases, stories and Lab updates.</p>
          )}
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
        <span>© 2026 ACRONOS · São Paulo, Brasil</span>
        <Crosshair className="h-5 w-5 text-line" />
        <span>ACN // EST. 2018</span>
      </div>
    </footer>
  );
}
