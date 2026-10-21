import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getDb } from "@/db/client";
import { OrderActions } from "@/components/admin/order-actions";
import { AdminPageHeader } from "@/components/admin/page-header";
import { formatMoney } from "@/lib/money";
import { requireStaff } from "@/server/auth";
import { getOrderAdmin } from "@/server/orders/admin";
import { hasPermission } from "@/server/rbac/permissions";
import { PAY_LABEL, SHIP_LABEL } from "@/lib/order-labels";
import { addShipmentAction, cancelUnpaidAction, markDeliveredAction, refundAction, resolveAttentionAction, setProcessingAction } from "../actions";

export const metadata: Metadata = { title: "Order" };

export default function OrderPage({ params }: PageProps<"/admin/orders/[id]">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <Order params={params} />
    </Suspense>
  );
}

const box = "flex flex-col gap-3 border border-line bg-surface p-5";
const h2 = "font-display text-sm uppercase tracking-[0.1em]";
const dt = (iso: string) => new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });

async function Order({ params }: Pick<PageProps<"/admin/orders/[id]">, "params">) {
  const ctx = await requireStaff("orders:read");
  const { id } = await params;
  const o = await getOrderAdmin(getDb(), ctx, id);
  if (!o) notFound();
  const money = (m: number) => formatMoney(m, o.currency);
  const a = o.shippingAddress;
  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader title={`Order ${o.number}`} description={`${dt(o.createdAt)} · ${PAY_LABEL[o.paymentStatus]} · ${SHIP_LABEL[o.fulfillmentStatus]}`} back={{ href: "/admin/orders", label: "Orders" }} />
      {o.needsAttention && (
        <p role="alert" className="border border-alert bg-paper p-4 text-sm text-alert">
          <strong>Needs attention:</strong> {o.needsAttention}
        </p>
      )}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-w-0 flex-col gap-6">
          <section className={box}>
            <h2 className={h2}>Items</h2>
            <ul className="divide-y divide-line text-sm">
              {o.items.map((i) => (
                <li key={i.id} className="flex justify-between gap-3 py-2">
                  <span>
                    {i.productName} × {i.quantity}
                    <span className="block font-mono text-[11px] text-muted">
                      {i.sku} · {[i.color, i.size].filter(Boolean).join(" / ")}
                    </span>
                  </span>
                  <span className="font-mono">{money(i.unitPriceMinor * i.quantity)}</span>
                </li>
              ))}
            </ul>
            <dl className="grid grid-cols-2 gap-1 border-t border-line pt-3 font-mono text-sm">
              <dt>Subtotal</dt>
              <dd className="text-right">{money(o.subtotalMinor)}</dd>
              <dt>Shipping {o.shippingMethod && `(${o.shippingMethod.name})`}</dt>
              <dd className="text-right">{money(o.shippingMinor)}</dd>
              <dt className="text-base">Total</dt>
              <dd className="text-right text-base">{money(o.totalMinor)}</dd>
              {o.refundedMinor > 0 && (
                <>
                  <dt className="text-alert">Refunded</dt>
                  <dd className="text-right text-alert">−{money(o.refundedMinor)}</dd>
                </>
              )}
            </dl>
          </section>
          <section className={box}>
            <h2 className={h2}>Payment</h2>
            {o.payments.length === 0 ? (
              <p className="text-sm text-muted">No confirmed payment{o.paymentProvider ? ` (${o.paymentProvider} checkout started)` : ""}.</p>
            ) : (
              <ul className="text-sm">
                {o.payments.map((p) => (
                  <li key={p.id} className="flex flex-wrap justify-between gap-2">
                    <span>
                      {p.provider} · <span className="font-mono text-xs">{p.providerPaymentId}</span>
                    </span>
                    <span className="font-mono">
                      {formatMoney(p.chargedAmountMinor, p.chargedCurrency)}
                      {p.chargedCurrency !== o.currency && <span className="text-muted"> (buyer&apos;s currency)</span>}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {o.refunds.length > 0 && (
              <ul className="border-t border-line pt-2 text-xs text-muted">
                {o.refunds.map((r) => (
                  <li key={r.id}>
                    Refund {money(r.amountMinor)} · {r.status} · {dt(r.createdAt)} {r.reason && `· ${r.reason}`}
                  </li>
                ))}
              </ul>
            )}
            {o.events.length > 0 && (
              <details className="text-xs text-muted">
                <summary className="cursor-pointer">Provider messages ({o.events.length})</summary>
                <ul className="mt-2">
                  {o.events.map((e, i) => (
                    <li key={i}>
                      {dt(e.receivedAt)} · {e.type}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </section>
          {o.shipments.length > 0 && (
            <section className={box}>
              <h2 className={h2}>Shipments</h2>
              {o.shipments.map((s) => (
                <p key={s.id} className="text-sm">
                  {s.carrier} ·{" "}
                  {s.trackingUrl ? (
                    <a href={s.trackingUrl} target="_blank" rel="noopener noreferrer" className="underline">
                      {s.trackingNumber}
                    </a>
                  ) : (
                    s.trackingNumber
                  )}
                  {s.shippedAt && ` · shipped ${dt(s.shippedAt)}`}
                  {s.deliveredAt && ` · delivered ${dt(s.deliveredAt)}`}
                </p>
              ))}
            </section>
          )}
        </div>
        <aside className="flex min-w-0 flex-col gap-6">
          <section className={box}>
            <h2 className={h2}>Customer</h2>
            <p className="text-sm">
              {o.email}
              {o.customer && (
                <Link href={`/admin/customers/${o.customer.id}`} className="block text-xs underline">
                  Customer account
                </Link>
              )}
            </p>
            {a ? (
              <p className="text-sm">
                {a.fullName}
                <br />
                {a.line1}
                {a.line2 && `, ${a.line2}`}
                <br />
                {a.city}
                {a.region && `, ${a.region}`} {a.postalCode}
                <br />
                {a.country}
                {a.phone && <span className="block text-muted">{a.phone}</span>}
              </p>
            ) : (
              <p className="text-xs text-muted">Your role cannot see the shipping address.</p>
            )}
            {o.shippingMethod?.dutiesModel === "ddu" && <p className="text-xs text-muted">Duties and import taxes: paid by the recipient (DDU).</p>}
          </section>
          <section className={box}>
            <h2 className={h2}>Actions</h2>
            <OrderActions
              order={{ id: o.id, currency: o.currency, paymentStatus: o.paymentStatus, processingStatus: o.processingStatus, fulfillmentStatus: o.fulfillmentStatus, refundableMinor: o.refundableMinor, needsAttention: o.needsAttention }}
              can={{ update: hasPermission(ctx.roles, "orders:update"), refund: hasPermission(ctx.roles, "orders:refund") }}
              actions={{ processing: setProcessingAction, ship: addShipmentAction, delivered: markDeliveredAction, resolve: resolveAttentionAction, cancel: cancelUnpaidAction, refund: refundAction }}
            />
          </section>
        </aside>
      </div>
    </div>
  );
}
