import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Wordmark } from "@/components/brand/wordmark";
import { requireStaff } from "@/server/auth";
import { hasPermission } from "@/server/rbac/permissions";
import { ADMIN_NAV } from "./nav";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <Suspense fallback={<p className="p-8 text-muted">Checking access…</p>}>
      <GuardedShell>{children}</GuardedShell>
    </Suspense>
  );
}

/** Runs on the server for every request: session, staff role, MFA and session age. */
async function GuardedShell({ children }: { children: React.ReactNode }) {
  const ctx = await requireStaff();
  const items = ADMIN_NAV.filter((item) => hasPermission(ctx.roles, item.permission));

  return (
    <div className="flex min-h-full flex-1 flex-col bg-surface md:flex-row">
      <aside className="border-b border-line p-4 md:w-60 md:shrink-0 md:border-b-0 md:border-r">
        <div className="mb-6 flex items-baseline gap-2">
          <Wordmark className="text-sm" />
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">Admin</span>
        </div>
        <nav aria-label="Admin">
          <ul className="flex flex-col gap-1 font-mono text-xs uppercase tracking-[0.1em]">
            {items.map((item) =>
              item.status === "implemented" ? (
                <li key={item.href}>
                  <Link href={item.href} className="block rounded-sm px-2 py-2 hover:bg-line">
                    {item.label}
                  </Link>
                </li>
              ) : (
                <li
                  key={item.href}
                  className="flex items-center justify-between px-2 py-2 text-muted/60"
                >
                  <span>
                    {item.label}
                    <span className="sr-only"> (not available yet)</span>
                  </span>
                  <span className="text-[9px]">Phase {item.phase}</span>
                </li>
              ),
            )}
          </ul>
        </nav>
        <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.1em] text-muted">
          {ctx.email} · {ctx.roles.join(", ").replaceAll("_", " ")}
        </p>
      </aside>
      <div className="flex-1 p-4 md:p-8">{children}</div>
    </div>
  );
}
