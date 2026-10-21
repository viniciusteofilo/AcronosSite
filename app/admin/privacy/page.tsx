import type { Metadata } from "next";
import { Suspense } from "react";
import { getDb } from "@/db/client";
import { AdminPageHeader } from "@/components/admin/page-header";
import { ActionButton } from "@/components/admin/row-actions";
import { listPrivacyRequests } from "@/server/account/self-service";
import { requireStaff } from "@/server/auth";
import { completeDeletionAction, rejectPrivacyAction } from "../pages/actions";

export const metadata: Metadata = { title: "Privacy requests" };

export default function PrivacyPage() {
  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        title="Privacy requests"
        description="Customers asking to erase their data (LGPD / GDPR). Answer within 15 days. Customers download their own data from their account."
      />
      <Suspense fallback={<p className="text-muted">Loading…</p>}>
        <List />
      </Suspense>
    </div>
  );
}

async function List() {
  const ctx = await requireStaff("privacy:handle");
  const items = await listPrivacyRequests(getDb(), ctx);
  if (items.length === 0) return <p className="border border-dashed border-field p-8 text-sm">No requests.</p>;
  return (
    <ul className="flex flex-col divide-y divide-line border border-line bg-surface">
      {items.map((r) => {
        const due = new Date(new Date(r.createdAt).getTime() + 15 * 86_400_000);
        const open = r.status === "received" || r.status === "in_progress";
        return (
          <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
            <span>
              {r.kind === "delete" ? "Erase account" : r.kind} · {r.email}
              <span className="block text-xs text-muted">
                {new Date(r.createdAt).toLocaleDateString("en-US", { dateStyle: "medium" })} · {r.status}
                {open && ` · answer by ${due.toLocaleDateString("en-US", { dateStyle: "medium" })}`}
              </span>
            </span>
            {open && r.kind === "delete" && (
              <span className="flex gap-2">
                <ActionButton label="Erase data" danger confirm="Erase permanently?" run={completeDeletionAction.bind(null, r.id)} />
                <ActionButton label="Reject" run={rejectPrivacyAction.bind(null, r.id)} />
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
