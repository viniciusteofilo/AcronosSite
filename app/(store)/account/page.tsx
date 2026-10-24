import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getDb } from "@/db/client";
import { DeleteAccount } from "@/components/account/session-list";
import { EmailChangeForm, NameForm, VerifyNotice } from "@/components/account/profile-forms";
import { formatMoney } from "@/lib/money";
import { PAY_LABEL, SHIP_LABEL } from "@/lib/order-labels";
import { getProfile } from "@/server/account/profile";
import { requireUser } from "@/server/auth";
import { listOrdersForCustomer } from "@/server/customers/orders";
import { changeEmailAction, requestDeletionAction, resendVerificationAction, updateNameAction } from "./actions";
import { SignOutButton } from "./sign-out-button";

export const metadata: Metadata = { title: "Account", robots: { index: false } };

const day = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" });
const h2 = "font-mono text-xs uppercase tracking-[0.12em] text-muted";

export default function AccountPage({ searchParams }: PageProps<"/account">) {
  return (
    <>
      <h1 className="font-display text-2xl uppercase tracking-[0.08em]">Account</h1>
      <Suspense fallback={<p className="text-muted">Loading…</p>}>
        <Content searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Content({ searchParams }: Pick<PageProps<"/account">, "searchParams">) {
  const ctx = await requireUser("/account");
  const db = getDb();
  const [profile, orders, sp] = await Promise.all([getProfile(db, ctx), listOrdersForCustomer(db, ctx.userId), searchParams]);
  return (
    <>
      {sp.verified === "1" && profile.emailVerified && (
        <p role="status" className="border border-line bg-surface p-4 text-sm">
          Thank you, your e-mail is confirmed.
        </p>
      )}
      {sp.email === "changed" && (
        <p role="status" className="border border-line bg-surface p-4 text-sm">
          Step done. Your account e-mail is now <strong>{profile.email}</strong>. If this is still the old address, open the link we sent to the new one to finish.
        </p>
      )}
      {sp.welcome === "1" && (
        <p role="status" className="border border-line bg-surface p-4 text-sm">
          Welcome to ACRONOS. Your account is ready.
        </p>
      )}
      {!profile.emailVerified && <VerifyNotice resend={resendVerificationAction} />}

      <section className="flex flex-col gap-4">
        <h2 className={h2}>Profile</h2>
        <NameForm name={profile.name} save={updateNameAction} />
        <p className="text-sm">
          <span className="text-muted">E-mail:</span> {profile.email} {profile.emailVerified && <span className="ml-1 font-mono text-[10px] uppercase tracking-[0.14em] text-signal-ink">Confirmed</span>}
        </p>
        <EmailChangeForm change={changeEmailAction} />
        <div className="flex flex-wrap gap-6 font-mono text-xs uppercase tracking-[0.12em]">
          {ctx.roles.length > 0 && (
            <Link href="/admin" className="text-muted hover:text-ink">
              Admin panel
            </Link>
          )}
          <SignOutButton />
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className={h2}>Orders</h2>
        {orders.length === 0 ? (
          <p className="text-muted">
            You have no orders yet.{" "}
            <Link href="/shop" className="text-ink underline underline-offset-4">
              Visit the shop
            </Link>
          </p>
        ) : (
          <ul className="divide-y divide-line border-y border-line">
            {orders.map((o) => (
              <li key={o.id}>
                <Link href={`/account/orders/${o.id}`} className="flex flex-wrap items-center justify-between gap-3 py-4 text-sm hover:bg-surface">
                  <span>
                    <span className="font-mono">{o.number}</span>
                    <span className="block text-xs text-muted">
                      {day.format(o.createdAt)} · {o.items} {o.items === 1 ? "item" : "items"}
                    </span>
                  </span>
                  <span className="text-right">
                    {formatMoney(o.totalMinor, o.currency)}
                    <span className="block font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
                      {o.paymentStatus === "paid" ? SHIP_LABEL[o.fulfillmentStatus] : PAY_LABEL[o.paymentStatus]}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className={h2}>Your data</h2>
        <p className="text-sm text-muted">Download everything we store about you, or ask us to erase your account. Order records are kept as required by tax law.</p>
        <a href="/api/account/export" className="self-start border border-field px-4 py-2 font-mono text-[10px] uppercase tracking-[0.14em] hover:border-ink">
          Download my data
        </a>
        {ctx.roles.length === 0 && <DeleteAccount request={requestDeletionAction} />}
      </section>
    </>
  );
}
