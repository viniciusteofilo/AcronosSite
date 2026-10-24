"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  ["/account", "Overview"],
  ["/account/addresses", "Addresses"],
  ["/account/security", "Security"],
] as const;

export function AccountNav() {
  const path = usePathname();
  return (
    <nav
      aria-label="Account"
      className="flex flex-wrap gap-x-6 gap-y-2 border-b border-line pb-4 font-mono text-[11px] uppercase tracking-[0.14em]"
    >
      {LINKS.map(([href, label]) => {
        const active =
          href === "/account"
            ? path === "/account" || path.startsWith("/account/orders")
            : path.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={
              active
                ? "text-ink underline underline-offset-8"
                : "text-muted hover:text-ink"
            }
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
