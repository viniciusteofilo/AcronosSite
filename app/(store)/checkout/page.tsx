import { connection } from "next/server";
import type { Metadata } from "next";
import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getDb } from "@/db/client";
import {
  Container,
  EmptyState,
  PageHeader,
} from "@/components/storefront/page-parts";
import { ButtonLink } from "@/components/ui/button";
import { listAddresses } from "@/server/account/profile";
import { getAccessContext } from "@/server/auth";
import { CART_COOKIE, getCart } from "@/server/cart/cart";
import {
  getCheckoutReadiness,
  getShippingOptions,
} from "@/server/store/settings";
import { checkoutAction } from "../cart/actions";
import { CheckoutForm } from "./checkout-form";

export const metadata: Metadata = {
  title: "Checkout",
  robots: { index: false },
};

export default function CheckoutPage() {
  return (
    <Container className="pb-24">
      <PageHeader eyebrow="Checkout //" title="Checkout" />
      <Suspense fallback={<div className="min-h-[40svh]" />}>
        <Checkout />
      </Suspense>
    </Container>
  );
}

async function Checkout() {
  await connection();
  const db = getDb();
  const id = (await cookies()).get(CART_COOKIE)?.value;
  const [cart, ready, options, ctx] = await Promise.all([
    getCart(db, id),
    getCheckoutReadiness(db),
    getShippingOptions(db),
    getAccessContext(),
  ]);
  if (!ready.open) {
    return (
      <div className="py-10">
        <EmptyState
          title="Online orders are not open yet"
          text="Follow us or join the newsletter to know when the store opens."
        />
      </div>
    );
  }
  if (cart.lines.length === 0 || cart.hasProblems) redirect("/cart");
  const saved = ctx ? await listAddresses(db, ctx) : [];
  return (
    <CheckoutForm
      action={checkoutAction}
      idempotencyKey={randomUUID()}
      email={ctx?.email ?? ""}
      signedIn={!!ctx}
      saved={saved}
      providers={ready.providers}
      options={Object.fromEntries(options)}
      lines={cart.lines.map((l) => ({
        variantId: l.variantId,
        name: l.productName,
        variant: [l.color, l.size].filter(Boolean).join(" / "),
        quantity: l.quantity,
        prices: l.prices,
      }))}
      backToCart={
        <ButtonLink href="/cart" variant="ghost" size="sm" arrow={false}>
          ← Edit cart
        </ButtonLink>
      }
    />
  );
}
