import { SiteFooter } from "@/components/storefront/site-footer";
import { Suspense } from "react";
import { HeaderWithCart } from "@/components/storefront/header-with-cart";
import { SiteHeader } from "@/components/storefront/site-header";
import { newsletterAction } from "./actions";

export default function StoreLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:bg-ink focus:px-4 focus:py-2 focus:text-canvas"
      >
        Skip to content
      </a>
      <Suspense fallback={<SiteHeader />}>
        <HeaderWithCart />
      </Suspense>
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter newsletterAction={newsletterAction} />
    </>
  );
}
