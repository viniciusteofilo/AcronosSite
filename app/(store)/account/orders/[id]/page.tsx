import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getDb } from "@/db/client";
import { OrderDetails } from "@/components/storefront/order-details";
import { requireUser } from "@/server/auth";
import { getOrderViewForCustomer } from "@/server/customers/orders";

export const metadata: Metadata = { title: "Order", robots: { index: false } };

export default function OrderPage({ params }: PageProps<"/account/orders/[id]">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <Body params={params} />
    </Suspense>
  );
}

async function Body({ params }: Pick<PageProps<"/account/orders/[id]">, "params">) {
  const { id } = await params;
  const ctx = await requireUser(`/account/orders/${id}`);
  const o = await getOrderViewForCustomer(getDb(), ctx.userId, id);
  if (!o) notFound();
  return (
    <>
      <Link href="/account" className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted hover:text-ink">
        ← Orders
      </Link>
      <h1 className="font-display text-2xl uppercase tracking-[0.08em]">Order {o.number}</h1>
      <OrderDetails o={o} />
    </>
  );
}
