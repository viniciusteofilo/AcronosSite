"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { LogoSymbol } from "@/components/brand/logo";
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
}: {
  links?: NavLink[];
  current?: string;
  cartCount?: number;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const searchRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const active = current;

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const iconBtn = "flex h-11 w-11 items-center justify-center text-ink/90 hover:text-ink";

  return (
    <header
      className="sticky top-0 z-40 border-b border-line bg-canvas/90 backdrop-blur-md"
    >
      <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-4 sm:px-8">
        <div className="flex items-center gap-1 lg:hidden">
          <button type="button" className={iconBtn} aria-label="Open menu" aria-haspopup="dialog" onClick={() => setOpen(true)}>
            <MenuIcon />
          </button>
        </div>

        <Link href={links[0]?.href ?? "/"} aria-label="ACRONOS home" className="flex items-center gap-3">
          <LogoSymbol className="h-6 w-auto" />
          <Wordmark className="text-lg" />
        </Link>

        <nav aria-label="Main" className="hidden lg:block">
          <ul className="flex items-center gap-9 font-mono text-[11px] uppercase tracking-[0.18em]">
            {links.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  aria-current={active === l.label ? "page" : undefined}
                  className={`border-b py-1 transition-colors ${active === l.label ? "border-ink text-ink" : "border-transparent text-ink/70 hover:text-ink"}`}
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center">
          <button type="button" className={iconBtn} aria-label="Search" aria-haspopup="dialog" onClick={() => searchRef.current?.showModal()}>
            <SearchIcon />
          </button>
          <Link href="/account" className={`${iconBtn} hidden sm:flex`} aria-label="Account">
            <UserIcon />
          </Link>
          <Link href="/cart" className={`${iconBtn} relative`} aria-label={`Cart, ${cartCount} ${cartCount === 1 ? "item" : "items"}`}>
            <BagIcon />
            {cartCount > 0 && (
              <span aria-hidden className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-ink px-1 font-mono text-[9px] text-canvas">
                {cartCount}
              </span>
            )}
          </Link>
        </div>
      </div>

      <dialog
        ref={dialogRef}
        aria-label="Menu"
        onClose={() => setOpen(false)}
        onClick={(e) => e.target === dialogRef.current && setOpen(false)}
        className="m-0 h-dvh max-h-none w-[min(88vw,380px)] max-w-none bg-paper p-0 text-ink shadow-2xl backdrop:bg-ink/30"
      >
        <div className="flex h-full flex-col">
          <div className="flex h-16 items-center justify-between border-b border-line px-4">
            <Wordmark className="text-sm" />
            <button type="button" className={iconBtn} aria-label="Close menu" onClick={() => setOpen(false)} autoFocus>
              <CloseIcon />
            </button>
          </div>
          <nav aria-label="Mobile" className="flex-1 overflow-y-auto px-4 py-6">
            <ul className="flex flex-col">
              {links.map((l, i) => (
                <li key={l.href} className="border-b border-line">
                  <Link
                    href={l.href}
                    onClick={() => setOpen(false)}
                    aria-current={active === l.label ? "page" : undefined}
                    className="flex items-baseline gap-4 py-5"
                  >
                    <span className="font-mono text-[10px] text-muted">{String(i + 1).padStart(2, "0")}</span>
                    <span className="font-display text-xl uppercase tracking-[0.08em]">{l.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div className="flex gap-6 border-t border-line px-4 py-5 font-mono text-[11px] uppercase tracking-[0.16em] text-muted">
            <Link href="/account" onClick={() => setOpen(false)} className="hover:text-ink">
              Account
            </Link>
            <span>USD</span>
          </div>
        </div>
      </dialog>

      <dialog
        ref={searchRef}
        aria-label="Search"
        onClick={(e) => e.target === searchRef.current && searchRef.current?.close()}
        className="mx-auto mt-0 w-full max-w-none bg-paper p-0 text-ink shadow-xl backdrop:bg-ink/30"
      >
        <form action="/shop" method="get" role="search" className="mx-auto flex max-w-[1440px] items-center gap-3 px-4 py-5 sm:px-8">
          <SearchIcon />
          <label htmlFor="site-search" className="sr-only">
            Search products
          </label>
          <input
            id="site-search"
            name="q"
            type="search"
            autoFocus
            placeholder="Search products"
            className="h-12 min-w-0 flex-1 bg-transparent font-display text-lg uppercase tracking-[0.06em] placeholder:text-muted/70 focus:outline-none"
          />
          <button type="submit" className="font-mono text-[11px] uppercase tracking-[0.16em]">
            Search
          </button>
          <button type="button" className={iconBtn} aria-label="Close search" onClick={() => searchRef.current?.close()}>
            <CloseIcon />
          </button>
        </form>
      </dialog>
    </header>
  );
}

/** Header that highlights the current section from the URL. Render inside <Suspense>. */
export function SiteHeaderAuto(props: { links?: NavLink[]; cartCount?: number }) {
  const pathname = usePathname();
  const links = props.links ?? MAIN_NAV;
  const current = [...links]
    .sort((a, b) => b.href.length - a.href.length)
    .find((l) => (l.href === "/" ? pathname === "/" : pathname?.startsWith(l.href)))?.label;
  return <SiteHeader {...props} current={current} />;
}
