import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getDb } from "@/db/client";
import { AdminPageHeader } from "@/components/admin/page-header";
import { requireStaff } from "@/server/auth";
import { listPagesAdmin } from "@/server/content/pages-admin";

export const metadata: Metadata = { title: "Pages" };

export default function PagesAdmin() {
  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader title="Pages" description="Institutional pages and policies. The homepage campaign is in the Site editor." />
      <Suspense fallback={<p className="text-muted">Loading…</p>}>
        <List />
      </Suspense>
    </div>
  );
}

async function List() {
  const ctx = await requireStaff("content:write");
  const items = await listPagesAdmin(getDb(), ctx);
  return (
    <ul className="flex flex-col divide-y divide-line border border-line bg-surface">
      {items.map((p) => (
        <li key={p.slug} className="flex flex-wrap items-center justify-between gap-3 px-4 py-4">
          <span className="flex min-w-0 flex-col">
            <Link href={`/admin/pages/${p.slug}`} className="font-medium hover:underline">
              {p.title}
            </Link>
            <span className="text-xs text-muted">
              {p.path}
              {p.updatedAt && ` · edited ${new Date(p.updatedAt).toLocaleDateString("en-US", { dateStyle: "medium" })}${p.editor ? ` by ${p.editor}` : ""}`}
            </span>
          </span>
          <span className={`inline-flex h-6 items-center border px-2 font-mono text-[10px] uppercase tracking-[0.14em] ${p.status === "published" ? "border-signal/60 text-signal-ink" : "border-line text-muted"}`}>
            {p.status === "missing" ? (p.kind === "policy" ? "Not written yet" : "Default text") : p.status}
          </span>
        </li>
      ))}
    </ul>
  );
}
