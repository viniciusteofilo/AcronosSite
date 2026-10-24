import { formatMoney } from "@/lib/money";
import { PAY_LABEL, SHIP_LABEL } from "@/lib/order-labels";
import type { OrderView } from "@/server/customers/orders";

const day = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" });

/** What the buyer sees about an order (account page and the link from e-mails). */
export function OrderDetails({ o }: { o: OrderView }) {
  const money = (m: number) => formatMoney(m, o.currency);
  const a = o.shippingAddress;
  const steps = [
    { label: "Ordered", date: o.createdAt, done: true },
    { label: "Paid", date: o.paidAt, done: !!o.paidAt },
    { label: "Shipped", date: o.shipments[0]?.shippedAt ?? null, done: ["shipped", "delivered", "partially_shipped"].includes(o.fulfillmentStatus) },
    { label: "Delivered", date: o.shipments.find((s) => s.deliveredAt)?.deliveredAt ?? null, done: o.fulfillmentStatus === "delivered" },
  ];
  return (
    <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="flex flex-col gap-8">
        <dl className="flex flex-wrap gap-x-8 gap-y-2 font-mono text-[11px] uppercase tracking-[0.14em]">
          <div>
            <dt className="text-muted">Payment</dt>
            <dd>{PAY_LABEL[o.paymentStatus] ?? o.paymentStatus}</dd>
          </div>
          <div>
            <dt className="text-muted">Shipping</dt>
            <dd>{SHIP_LABEL[o.fulfillmentStatus] ?? o.fulfillmentStatus}</dd>
          </div>
        </dl>
        {o.paymentStatus !== "canceled" && o.paymentStatus !== "failed" && (
          <ol className="grid grid-cols-4 gap-2" aria-label="Order progress">
            {steps.map((s) => (
              <li key={s.label} className="flex flex-col gap-2">
                <span className={`h-1 ${s.done ? "bg-ink" : "bg-line"}`} />
                <span className={`font-mono text-[10px] uppercase tracking-[0.14em] ${s.done ? "" : "text-muted"}`}>
                  {s.label}
                  <span className="sr-only">{s.done ? " (done)" : " (not yet)"}</span>
                </span>
                {s.done && s.date && <span className="text-xs text-muted">{day.format(s.date)}</span>}
              </li>
            ))}
          </ol>
        )}
        {o.shipments.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="font-mono text-xs uppercase tracking-[0.12em] text-muted">Tracking</h2>
            <ul className="divide-y divide-line border-y border-line text-sm">
              {o.shipments.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <span>
                    {s.carrier ?? "Carrier"} {s.trackingNumber && <span className="font-mono">· {s.trackingNumber}</span>}
                    <span className="block text-xs text-muted">{s.deliveredAt ? `Delivered ${day.format(s.deliveredAt)}` : s.shippedAt ? `Shipped ${day.format(s.shippedAt)}` : ""}</span>
                  </span>
                  {s.trackingUrl && /^https:\/\//.test(s.trackingUrl) && (
                    <a href={s.trackingUrl} target="_blank" rel="noopener noreferrer" className="font-mono text-[11px] uppercase tracking-[0.14em] underline underline-offset-4">
                      Track package<span className="sr-only"> (opens the carrier site)</span>
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
        {o.refunds.length > 0 && (
          <p className="text-sm">
            Refunded: {money(o.refunds.reduce((s, r) => s + r.amountMinor, 0))}. Banks usually take 5 to 10 business days to show it.
          </p>
        )}
        <p className="text-sm text-muted">Questions about this order? Use the contact page with the order number {o.number}.</p>
      </div>
      <aside className="flex flex-col gap-4 self-start border border-line bg-surface p-6 text-sm">
        <ul className="flex flex-col gap-2">
          {o.items.map((i) => (
            <li key={i.id} className="flex justify-between gap-3">
              <span>
                {i.productName} × {i.quantity}
                {i.options && <span className="block text-xs text-muted">{i.options}</span>}
              </span>
              <span className="font-mono">{money(i.unitPriceMinor * i.quantity)}</span>
            </li>
          ))}
        </ul>
        <dl className="flex flex-col gap-1 border-t border-line pt-3 font-mono">
          <div className="flex justify-between">
            <dt>Subtotal</dt>
            <dd>{money(o.subtotalMinor)}</dd>
          </div>
          {o.discountMinor > 0 && (
            <div className="flex justify-between">
              <dt>Discount</dt>
              <dd>−{money(o.discountMinor)}</dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt>Shipping{o.shippingMethod?.name ? ` (${o.shippingMethod.name})` : ""}</dt>
            <dd>{o.shippingMinor === 0 ? "Free" : money(o.shippingMinor)}</dd>
          </div>
          {o.taxMinor > 0 && (
            <div className="flex justify-between">
              <dt>Tax</dt>
              <dd>{money(o.taxMinor)}</dd>
            </div>
          )}
          {o.dutiesMinor > 0 && (
            <div className="flex justify-between">
              <dt>Import duties</dt>
              <dd>{money(o.dutiesMinor)}</dd>
            </div>
          )}
          <div className="flex justify-between text-base">
            <dt>Total</dt>
            <dd>{money(o.totalMinor)}</dd>
          </div>
        </dl>
        {a && (
          <p className="border-t border-line pt-3 text-xs text-muted">
            Ship to: {a.fullName}, {a.line1}
            {a.line2 ? `, ${a.line2}` : ""}, {a.city} {a.region ?? ""} {a.postalCode}, {a.country}
          </p>
        )}
      </aside>
    </div>
  );
}
