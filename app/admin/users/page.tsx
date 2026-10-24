import type { Metadata } from "next";
import { Suspense } from "react";
import { getDb } from "@/db/client";
import { AdminPageHeader } from "@/components/admin/page-header";
import { ActionButton, GrantRoleForm } from "@/components/admin/row-actions";
import { requireStaff } from "@/server/auth";
import { listStaff } from "@/server/admin/people";
import { ROLE_PERMISSIONS } from "@/server/rbac/permissions";
import { grantRoleAction, resetTwoFactorAction, revokeRoleAction } from "../pages/actions";

export const metadata: Metadata = { title: "Users" };

const ROLE_LABELS = { super_admin: "Super admin", manager: "Manager", content_editor: "Content editor", order_manager: "Order manager" } as const;
const ROLE_HELP = {
  super_admin: "Everything, including users and settings.",
  manager: "Products, stock, orders, refunds, customers, content and marketing.",
  content_editor: "Site editor, pages, Sci-Fi, Lab and images. Sees products read-only.",
  order_manager: "Orders and shipping addresses.",
} as const;

export default function UsersPage() {
  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader title="Users" description="Who can use this admin. Everyone needs two-factor authentication to enter." />
      <Suspense fallback={<p className="text-muted">Loading…</p>}>
        <Staff />
      </Suspense>
    </div>
  );
}

async function Staff() {
  const ctx = await requireStaff("users:manage");
  const staff = await listStaff(getDb(), ctx);
  return (
    <>
      <section className="flex flex-col gap-4 border border-line bg-surface p-5">
        <h2 className="font-display text-sm uppercase tracking-[0.1em]">Add someone</h2>
        <p className="text-sm text-muted">The person first creates an account on the site (Sign in → Create account). Then add a role here. On their next sign-in they will be asked to turn on two-factor.</p>
        <GrantRoleForm grant={grantRoleAction} />
      </section>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-line text-left font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
              <th className="py-2 pr-3 font-normal">Person</th>
              <th className="py-2 pr-3 font-normal">Two-factor</th>
              <th className="py-2 font-normal">Roles</th>
            </tr>
          </thead>
          <tbody>
            {staff.map((u) => (
              <tr key={u.id} className="border-b border-line align-top">
                <td className="py-3 pr-3">
                  {u.name}
                  <span className="block text-xs text-muted">{u.email}{u.id === ctx.userId && " · you"}</span>
                </td>
                <td className={`py-3 pr-3 text-xs ${u.twoFactorEnabled ? "" : "text-alert"}`}>
                  {u.twoFactorEnabled ? "On" : "Off — cannot enter yet"}
                  {u.twoFactorEnabled && u.id !== ctx.userId && (
                    <span className="mt-1 block">
                      <ActionButton label="Reset (lost phone)" danger confirm="Turn off and sign out?" run={resetTwoFactorAction.bind(null, u.id)} />
                    </span>
                  )}
                </td>
                <td className="py-3">
                  <ul className="flex flex-col gap-2">
                    {u.roles.map((r) => (
                      <li key={r} className="flex flex-wrap items-center justify-between gap-2">
                        <span>
                          {ROLE_LABELS[r]}
                          <span className="block text-xs text-muted">{ROLE_HELP[r]}</span>
                        </span>
                        <ActionButton label="Remove" danger confirm={`Remove ${ROLE_LABELS[r]}?`} run={revokeRoleAction.bind(null, { targetUserId: u.id, role: r })} />
                      </li>
                    ))}
                  </ul>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <details className="text-xs text-muted">
        <summary className="cursor-pointer">What each role can do (technical)</summary>
        <ul className="mt-2 flex flex-col gap-1">
          {Object.entries(ROLE_PERMISSIONS).map(([r, perms]) => (
            <li key={r}>
              <strong>{ROLE_LABELS[r as keyof typeof ROLE_LABELS]}:</strong> {perms.join(", ")}
            </li>
          ))}
        </ul>
      </details>
    </>
  );
}
