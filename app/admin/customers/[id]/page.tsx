import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getDb } from "@/db/client";
import { AdminPageHeader } from "@/components/admin/page-header";
import { formatMoney } from "@/lib/money";
import { requireStaff } from "@/server/auth";
import { getCustomer } from "@/server/admin/people";

export const metadata: Metadata = { title: "Customer" };

export default function CustomerPage({ params }: PageProps<"/admin/customers/[id]">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <Customer params={params} />
    </Suspense>
  );
}

const box = "flex flex-col gap-3 border border-line bg-surface p-5";
const h2 = "font-display text-sm uppercase tracking-[0.1em]";

async function Customer({ params }: Pick<PageProps<"/admin/customers/[id]">, "params">) {
  const ctx = await requireStaff("customers:read");
  const { id } = await params;
  const c = await getCustomer(getDb(), ctx, id);
  if (!c) notFound();
  const d = (iso: string) => new Date(iso).toLocaleDateString("en-US", { dateStyle: "medium" });
  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader title={c.name} description={`${c.email} · customer since ${d(c.createdAt)}${c.emailVerified ? " · e-mail verified" : ""}`} back={{ href: "/admin/customers", label: "Customers" }} />
      <div className="grid gap-6 lg:grid-cols-2">
        <section className={box}>
          <h2 className={h2}>Orders ({c.orders.length})</h2>
          {c.orders.length === 0 ? (
            <p className="text-sm text-muted">No orders yet.</p>
          ) : (
            <ul className="divide-y divide-line text-sm">
              {c.orders.map((o) => (
                <li key={o.id} className="flex justify-between gap-3 py-2">
                  <span className="font-mono text-xs">{o.number}</span>
                  <span>{formatMoney(o.totalMinor, o.currency)}</span>
                  <span className="text-xs text-muted">{o.paymentStatus} · {o.fulfillmentStatus}</span>
                  <span className="text-xs text-muted">{d(o.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className={box}>
          <h2 className={h2}>Addresses</h2>
          {c.addresses === null ? (
            <p className="text-sm text-muted">Your role cannot see shipping addresses.</p>
          ) : c.addresses.length === 0 ? (
            <p className="text-sm text-muted">No saved addresses.</p>
          ) : (
            <ul className="flex flex-col gap-3 text-sm">
              {c.addresses.map((a) => (
                <li key={a.id}>
                  {a.fullName}
                  <br />
                  {a.line1}
                  {a.line2 && `, ${a.line2}`}
                  <br />
                  {a.city}
                  {a.region && `, ${a.region}`} {a.postalCode} · {a.country}
                  {a.phone && <span className="block text-muted">{a.phone}</span>}
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className={box}>
          <h2 className={h2}>Newsletter</h2>
          <p className="text-sm">{c.newsletter ? `${c.newsletter.status}${c.newsletter.consentAt ? ` · consent ${d(c.newsletter.consentAt)}` : ""}` : "Not subscribed."}</p>
        </section>
        <section className={box}>
          <h2 className={h2}>Messages</h2>
          {c.messages.length === 0 ? (
            <p className="text-sm text-muted">No messages.</p>
          ) : (
            <ul className="divide-y divide-line text-sm">
              {c.messages.map((m) => (
                <li key={m.id} className="flex justify-between py-2">
                  <span>{m.topic}</span>
                  <span className="text-xs text-muted">{m.status} · {d(m.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      <p className="text-xs text-muted">Viewing a customer is recorded in the audit log.</p>
    </div>
  );
}
