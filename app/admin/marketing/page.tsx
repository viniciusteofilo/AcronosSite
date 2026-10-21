import type { Metadata } from "next";
import { Suspense } from "react";
import { getDb } from "@/db/client";
import { AdminPageHeader } from "@/components/admin/page-header";
import { ActionButton } from "@/components/admin/row-actions";
import { requireStaff } from "@/server/auth";
import { listSubscribers } from "@/server/admin/people";
import { unsubscribeAction } from "../pages/actions";

export const metadata: Metadata = { title: "Newsletter" };

export default function MarketingPage() {
  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        title="Newsletter"
        description="People who signed up on the site, with when and where they gave consent."
        actions={
          <a href="/api/admin/newsletter" className="inline-flex h-10 items-center border border-field px-4 font-mono text-[10px] uppercase tracking-[0.14em] hover:border-ink">
            Download CSV
          </a>
        }
      />
      <p className="max-w-3xl border border-line bg-paper p-4 text-sm">
        Sign-ups stay <strong>pending</strong> until the person confirms by e-mail. Confirmation e-mails start when an e-mail provider is connected (planned). Only send campaigns to <strong>confirmed</strong> addresses.
      </p>
      <Suspense fallback={<p className="text-muted">Loading…</p>}>
        <List />
      </Suspense>
    </div>
  );
}

async function List() {
  const ctx = await requireStaff("marketing:write");
  const data = await listSubscribers(getDb(), ctx);
  return (
    <>
      <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted">
        Pending {data.counts.pending} · Confirmed {data.counts.confirmed} · Unsubscribed {data.counts.unsubscribed}
      </p>
      {data.items.length === 0 ? (
        <p className="border border-dashed border-field p-8 text-sm">No sign-ups yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-line text-left font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
                <th className="py-2 pr-3 font-normal">E-mail</th>
                <th className="py-2 pr-3 font-normal">Status</th>
                <th className="py-2 pr-3 font-normal">Where</th>
                <th className="py-2 pr-3 font-normal">Consent</th>
                <th className="py-2 font-normal">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((s) => (
                <tr key={s.id} className="border-b border-line">
                  <td className="py-2 pr-3">{s.email}</td>
                  <td className="py-2 pr-3 text-xs">{s.status}</td>
                  <td className="py-2 pr-3 text-xs text-muted">{s.source}</td>
                  <td className="py-2 pr-3 text-xs text-muted">{s.consentAt ? new Date(s.consentAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }) : "—"}</td>
                  <td className="py-2 text-right">{s.status !== "unsubscribed" && <ActionButton label="Unsubscribe" danger confirm="Remove?" run={unsubscribeAction.bind(null, s.id)} />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
