import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getDb } from "@/db/client";
import { AdminPageHeader } from "@/components/admin/page-header";
import { requireStaff } from "@/server/auth";
import { listAdminCollections } from "@/server/catalog/collections-admin";
import { hasPermission } from "@/server/rbac/permissions";

export const metadata: Metadata = { title: "Collections" };

export default function CollectionsAdminPage() {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <List />
    </Suspense>
  );
}

async function List() {
  const ctx = await requireStaff("products:read");
  const items = await listAdminCollections(getDb(), ctx);
  const canEdit = hasPermission(ctx.roles, "products:write");
  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        title="Collections"
        description="Drops and campaigns. Each has a banner, a text and its products in order."
        actions={
          canEdit && (
            <Link href="/admin/collections/new" className="inline-flex h-10 items-center bg-ink px-5 font-mono text-[10px] uppercase tracking-[0.14em] text-canvas hover:bg-muted">
              New collection
            </Link>
          )
        }
      />
      {items.length === 0 ? (
        <p className="border border-dashed border-field p-8 text-sm">No collections yet.</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((c) => (
            <li key={c.id}>
              <Link href={`/admin/collections/${c.id}`} className="group flex flex-col border border-line bg-surface hover:border-ink">
                <div className="aspect-video overflow-hidden bg-canvas">
                  {c.image ? (
                    // eslint-disable-next-line @next/next/no-img-element -- admin thumbnail
                    <img src={c.image.src} srcSet={c.image.srcSet} sizes="400px" alt="" className="h-full w-full object-cover" style={{ objectPosition: `${c.image.focalX * 100}% ${c.image.focalY * 100}%` }} />
                  ) : (
                    <span className="flex h-full items-center justify-center font-mono text-[10px] uppercase tracking-[0.16em] text-muted">No banner</span>
                  )}
                </div>
                <div className="flex items-center justify-between gap-3 p-4">
                  <span className="min-w-0">
                    <span className="block truncate font-medium group-hover:underline">{c.name}</span>
                    <span className="text-xs text-muted">{c.products} product(s)</span>
                  </span>
                  <span className={`inline-flex h-6 items-center border px-2 font-mono text-[10px] uppercase tracking-[0.14em] ${c.status === "published" ? "border-signal/60 text-signal-ink" : "border-line text-muted"}`}>{c.status}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
