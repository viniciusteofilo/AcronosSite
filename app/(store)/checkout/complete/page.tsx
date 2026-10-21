import { connection } from "next/server";
import type { Metadata } from "next";
import { Suspense } from "react";
import { getDb } from "@/db/client";
import {
  Container,
  EmptyState,
  PageHeader,
} from "@/components/storefront/page-parts";
import { ButtonLink } from "@/components/ui/button";
import { formatMoney } from "@/lib/money";
import { getOrderForBuyer } from "@/server/orders/checkout";
import { AutoRefresh } from "./auto-refresh";

export const metadata: Metadata = { title: "Order", robots: { index: false } };

export default function CompletePage({
  searchParams,
}: PageProps<"/checkout/complete">) {
  return (
    <Container className="pb-24">
      <Suspense fallback={<div className="min-h-[40svh]" />}>
        <Status searchParams={searchParams} />
      </Suspense>
    </Container>
  );
}

/**
 * Returning here never marks an order paid. The page shows what the database says, which only
 * changes when Stripe or PayPal confirm the payment.
 */
async function Status({
  searchParams,
}: Pick<PageProps<"/checkout/complete">, "searchParams">) {
  await connection();
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) =>
    (Array.isArray(v) ? v[0] : v) ?? "";
  const o = await getOrderForBuyer(getDb(), one(sp.order), one(sp.t));
  if (!o) {
    return (
      <div className="py-16">
        <EmptyState
          title="Order not found"
          text="Check the link, or contact us with your e-mail address."
        />
      </div>
    );
  }
  const money = (m: number) => formatMoney(m, o.currency);
  const paid = ["paid", "partially_refunded", "refunded"].includes(
    o.paymentStatus,
  );
  const addr = o.shippingAddress as Record<string, string> | null;
  return (
    <>
      <PageHeader
        eyebrow={`Order ${o.number} //`}
        title={
          paid
            ? "Thank you"
            : o.paymentStatus === "pending"
              ? "Confirming payment"
              : "Payment not completed"
        }
      />
      <div className="grid gap-12 py-10 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex flex-col gap-6">
          {paid && (
            <p className="text-lg">
              Your payment was confirmed. We will prepare your order and send
              tracking details to {o.email}.
            </p>
          )}
          {o.paymentStatus === "pending" && (
            <>
              <p role="status" className="text-lg">
                We are waiting for the payment provider to confirm your payment.
                This usually takes a few seconds.
              </p>
              <AutoRefresh />
            </>
          )}
          {(o.paymentStatus === "canceled" || o.paymentStatus === "failed") && (
            <>
              <p className="text-lg">
                This checkout was canceled or expired, and nothing was charged.
              </p>
              <ButtonLink href="/cart" variant="secondary" size="sm">
                Back to cart
              </ButtonLink>
            </>
          )}
          <p className="text-sm text-muted">
            Keep this page&apos;s link to check your order status. Questions:
            use the contact page with your order number.
          </p>
        </div>
        <aside className="flex flex-col gap-4 self-start border border-line bg-surface p-6 text-sm">
          <ul className="flex flex-col gap-2">
            {o.items.map((i) => (
              <li key={i.id} className="flex justify-between gap-3">
                <span>
                  {i.productName} × {i.quantity}
                  <span className="block text-xs text-muted">
                    {[i.color, i.size].filter(Boolean).join(" / ")}
                  </span>
                </span>
                <span className="font-mono">
                  {money(i.unitPriceMinor * i.quantity)}
                </span>
              </li>
            ))}
          </ul>
          <dl className="flex flex-col gap-1 border-t border-line pt-3 font-mono">
            <div className="flex justify-between">
              <dt>Shipping</dt>
              <dd>{o.shippingMinor === 0 ? "Free" : money(o.shippingMinor)}</dd>
            </div>
            <div className="flex justify-between text-base">
              <dt>Total</dt>
              <dd>{money(o.totalMinor)}</dd>
            </div>
          </dl>
          {addr && (
            <p className="border-t border-line pt-3 text-xs text-muted">
              Ship to: {addr.fullName}, {addr.line1}
              {addr.line2 ? `, ${addr.line2}` : ""}, {addr.city}{" "}
              {addr.postalCode}, {addr.country}
            </p>
          )}
        </aside>
      </div>
    </>
  );
}
