import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getDb } from "@/db/client";
import { formatMoney } from "@/lib/money";
import { requireUser } from "@/server/auth";
import { listOrdersForCustomer } from "@/server/customers/orders";
import { SignOutButton } from "./sign-out-button";

export const metadata: Metadata = { title: "Account", robots: { index: false } };

export default function AccountPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-10 px-4 py-16">
      <h1 className="font-display text-2xl uppercase tracking-[0.08em]">Account</h1>
      <Suspense fallback={<p className="text-muted">Loading…</p>}>
        <Content />
      </Suspense>
    </main>
  );
}

async function Content() {
  const ctx = await requireUser("/account");
  const orders = await listOrdersForCustomer(getDb(), ctx.userId);
  return (
    <>
      <section className="flex flex-col gap-2">
        <p className="text-muted">Signed in as {ctx.email}</p>
        <div className="flex flex-wrap gap-6 font-mono text-xs uppercase tracking-[0.12em]">
          <Link href="/account/security" className="text-muted hover:text-ink">
            Security
          </Link>
          {ctx.roles.length > 0 && (
            <Link href="/admin" className="text-muted hover:text-ink">
              Admin panel
            </Link>
          )}
          <SignOutButton />
        </div>
      </section>
      <section className="flex flex-col gap-4">
        <h2 className="font-mono text-xs uppercase tracking-[0.12em] text-muted">Orders</h2>
        {orders.length === 0 ? (
          <p className="text-muted">You have no orders yet.</p>
        ) : (
          <ul className="divide-y divide-line border-y border-line">
            {orders.map((o) => (
              <li key={o.id} className="flex justify-between py-3 text-sm">
                <span className="font-mono">{o.number}</span>
                <span>{formatMoney(o.totalMinor, o.currency)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
