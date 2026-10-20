"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Wordmark } from "@/components/brand/wordmark";
import { BagIcon, CloseIcon, MenuIcon, SearchIcon, UserIcon } from "@/components/icons";
import { MAIN_NAV, type NavLink } from "./nav";

/**
 * Storefront header. Desktop: inline navigation. Mobile: a native <dialog> drawer, which
 * gives focus trapping, Escape to close and an inert background without custom code.
 */
export function SiteHeader({
  links = MAIN_NAV,
  current,
  cartCount = 0,
  overlay = false,
}: {
  links?: NavLink[];
  current?: string;
  cartCount?: number;
  /** Transparent over a hero image; solid otherwise. */
  overlay?: boolean;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const iconBtn = "flex h-11 w-11 items-center justify-center text-snow/90 hover:text-snow";

  return (
    <header
      className={`${overlay ? "absolute inset-x-0 top-0 bg-gradient-to-b from-void/80 to-transparent" : "sticky top-0 border-b border-concrete bg-void/95 backdrop-blur"} z-40`}
    >
      <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-4 sm:px-8">
        <div className="flex items-center gap-1 lg:hidden">
          <button type="button" className={iconBtn} aria-label="Open menu" aria-haspopup="dialog" onClick={() => setOpen(true)}>
            <MenuIcon />
          </button>
        </div>

        <Link href={links[0]?.href ?? "/"} aria-label="ACRONOS home" className="flex items-center">
          <Wordmark className="text-base" />
        </Link>

        <nav aria-label="Main" className="hidden lg:block">
          <ul className="flex items-center gap-9 font-mono text-[11px] uppercase tracking-[0.18em]">
            {links.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  aria-current={current === l.label ? "page" : undefined}
                  className={`border-b py-1 transition-colors ${current === l.label ? "border-snow text-snow" : "border-transparent text-snow/70 hover:text-snow"}`}
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center">
          <button type="button" className={iconBtn} aria-label="Search">
            <SearchIcon />
          </button>
          <Link href="/account" className={`${iconBtn} hidden sm:flex`} aria-label="Account">
            <UserIcon />
          </Link>
          <button type="button" className={`${iconBtn} relative`} aria-label={`Cart, ${cartCount} ${cartCount === 1 ? "item" : "items"}`}>
            <BagIcon />
            {cartCount > 0 && (
              <span aria-hidden className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-snow px-1 font-mono text-[9px] text-void">
                {cartCount}
              </span>
            )}
          </button>
        </div>
      </div>

      <dialog
        ref={dialogRef}
        aria-label="Menu"
        onClose={() => setOpen(false)}
        onClick={(e) => e.target === dialogRef.current && setOpen(false)}
        className="m-0 h-dvh max-h-none w-[min(88vw,380px)] max-w-none bg-carbon p-0 text-snow backdrop:bg-void/70"
      >
        <div className="flex h-full flex-col">
          <div className="flex h-16 items-center justify-between border-b border-concrete px-4">
            <Wordmark className="text-sm" />
            <button type="button" className={iconBtn} aria-label="Close menu" onClick={() => setOpen(false)} autoFocus>
              <CloseIcon />
            </button>
          </div>
          <nav aria-label="Mobile" className="flex-1 overflow-y-auto px-4 py-6">
            <ul className="flex flex-col">
              {links.map((l, i) => (
                <li key={l.href} className="border-b border-concrete">
                  <Link
                    href={l.href}
                    onClick={() => setOpen(false)}
                    aria-current={current === l.label ? "page" : undefined}
                    className="flex items-baseline gap-4 py-5"
                  >
                    <span className="font-mono text-[10px] text-steel">{String(i + 1).padStart(2, "0")}</span>
                    <span className="font-display text-xl uppercase tracking-[0.08em]">{l.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div className="flex gap-6 border-t border-concrete px-4 py-5 font-mono text-[11px] uppercase tracking-[0.16em] text-steel">
            <Link href="/account" onClick={() => setOpen(false)} className="hover:text-snow">
              Account
            </Link>
            <span>USD</span>
          </div>
        </div>
      </dialog>
    </header>
  );
}
