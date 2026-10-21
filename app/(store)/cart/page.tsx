import { connection } from "next/server";
import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { Suspense } from "react";
import { getDb } from "@/db/client";
import {
  Container,
  EmptyState,
  PageHeader,
} from "@/components/storefront/page-parts";
import { SiteImage } from "@/components/storefront/site-image";
import { ButtonLink } from "@/components/ui/button";
import { formatMoney } from "@/lib/money";
import { CART_COOKIE, getCart, MAX_PER_LINE } from "@/server/cart/cart";
import { getCheckoutReadiness } from "@/server/store/settings";
import { updateCartAction } from "./actions";
import { QuantitySelect } from "./quantity-select";

export const metadata: Metadata = { title: "Cart", robots: { index: false } };

export default function CartPage({ searchParams }: PageProps<"/cart">) {
  return (
    <Container className="pb-24">
      <PageHeader eyebrow="Cart //" title="Your cart" />
      <Suspense fallback={<div className="min-h-[30svh]" />}>
        <Canceled searchParams={searchParams} />
        <Cart />
      </Suspense>
    </Container>
  );
}

async function Canceled({
  searchParams,
}: Pick<PageProps<"/cart">, "searchParams">) {
  if ((await searchParams).canceled !== "1") return null;
  return (
    <p role="status" className="mt-8 border border-line bg-surface p-4 text-sm">
      Payment canceled. Nothing was charged, and your items are back in your
      cart.
    </p>
  );
}

async function Cart() {
  await connection();
  const db = getDb();
  const id = (await cookies()).get(CART_COOKIE)?.value;
  const [cart, ready] = await Promise.all([
    getCart(db, id),
    getCheckoutReadiness(db),
  ]);
  if (cart.lines.length === 0) {
    return (
      <div className="py-10">
        <EmptyState
          title="Your cart is empty"
          text={
            ready.open
              ? "Find something in the shop."
              : "Online orders open with the store launch."
          }
        >
          <ButtonLink href="/shop" variant="secondary" size="sm">
            Browse the shop
          </ButtonLink>
        </EmptyState>
      </div>
    );
  }
  const usd = (m: number) => formatMoney(m, "USD");
  return (
    <div className="grid gap-12 py-10 lg:grid-cols-[minmax(0,1fr)_360px]">
      <ul className="flex flex-col divide-y divide-line border-y border-line">
        {cart.lines.map((l) => (
          <li
            key={l.variantId}
            className="grid grid-cols-[88px_minmax(0,1fr)] gap-4 py-5 sm:grid-cols-[110px_minmax(0,1fr)_auto]"
          >
            <Link href={`/products/${l.productSlug}`} className="block">
              <SiteImage media={l.image} label="" ratio="4/5" sizes="110px" />
            </Link>
            <div className="flex min-w-0 flex-col gap-1">
              <Link
                href={`/products/${l.productSlug}`}
                className="font-display text-sm uppercase tracking-[0.08em] hover:underline"
              >
                {l.productName}
              </Link>
              <p className="text-sm text-muted">
                {[l.color, l.size].filter(Boolean).join(" / ")}
              </p>
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
                {l.sku}
              </p>
              {l.problem && (
                <p role="alert" className="text-sm text-alert">
                  {l.problem}
                </p>
              )}
              <div className="mt-2 flex items-center gap-4">
                <QuantitySelect
                  variantId={l.variantId}
                  quantity={l.quantity}
                  max={Math.min(
                    MAX_PER_LINE,
                    Math.max(l.available, l.quantity),
                  )}
                  action={updateCartAction}
                />
                <form action={updateCartAction}>
                  <input type="hidden" name="variantId" value={l.variantId} />
                  <input type="hidden" name="quantity" value="0" />
                  <button
                    type="submit"
                    className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted underline hover:text-ink"
                  >
                    Remove
                  </button>
                </form>
              </div>
            </div>
            <p className="col-start-2 font-mono text-sm sm:col-start-3 sm:text-right">
              {l.prices.USD !== undefined
                ? usd(l.prices.USD * l.quantity)
                : "—"}
            </p>
          </li>
        ))}
      </ul>
      <aside className="flex flex-col gap-5 self-start border border-line bg-surface p-6">
        <dl className="flex justify-between font-mono text-sm">
          <dt className="uppercase tracking-[0.14em]">Subtotal</dt>
          <dd>{usd(cart.subtotalUsd)}</dd>
        </dl>
        <p className="text-xs text-muted">
          Shipping is calculated at checkout. Buyers outside the US may pay in
          their own currency; import duties and taxes, when they apply, are paid
          on delivery.
        </p>
        {!ready.open ? (
          <p className="text-sm">Online orders are not open yet.</p>
        ) : cart.hasProblems ? (
          <p className="text-sm text-alert">
            Update the items marked above to continue.
          </p>
        ) : (
          <ButtonLink href="/checkout" className="w-full">
            Checkout
          </ButtonLink>
        )}
        <Link href="/shop" className="text-center text-sm underline">
          Continue shopping
        </Link>
      </aside>
    </div>
  );
}
