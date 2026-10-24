import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getDb } from "@/db/client";
import { AdminPageHeader } from "@/components/admin/page-header";
import { requireStaff } from "@/server/auth";
import { listStoriesAdmin } from "@/server/content/stories-admin";

export const metadata: Metadata = { title: "Acronos Sci-Fi" };

export default function SciFiAdmin() {
  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        title="Acronos Sci-Fi"
        description="Stories in the Sci-Fi library. Paste from Word or Google Docs: only basic formatting is kept."
        actions={
          <div className="flex gap-2">
            <Link
              href="/admin/sci-fi/import"
              className="inline-flex h-10 items-center border border-field px-4 font-mono text-[10px] uppercase tracking-[0.14em] hover:border-ink"
            >
              Import files
            </Link>
            <Link
              href="/admin/sci-fi/new"
              className="inline-flex h-10 items-center bg-ink px-5 font-mono text-[10px] uppercase tracking-[0.14em] text-canvas hover:bg-muted"
            >
              New story
            </Link>
          </div>
        }
      />
      <Suspense fallback={<p className="text-muted">Loading…</p>}>
        <List />
      </Suspense>
    </div>
  );
}

async function List() {
  const ctx = await requireStaff("content:write");
  const items = await listStoriesAdmin(getDb(), ctx);
  if (items.length === 0)
    return (
      <p className="border border-dashed border-field p-8 text-sm">
        No stories yet.
      </p>
    );
  return (
    <ul className="flex flex-col divide-y divide-line border border-line bg-surface">
      {items.map((s) => (
        <li key={s.id} className="flex items-center gap-4 px-4 py-3">
          <span className="block aspect-[2/1] w-24 shrink-0 overflow-hidden border border-line bg-canvas">
            {s.cover && (
              // eslint-disable-next-line @next/next/no-img-element -- admin thumbnail
              <img
                src={s.cover.src}
                srcSet={s.cover.srcSet}
                sizes="96px"
                alt=""
                className="h-full w-full object-cover"
              />
            )}
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <Link
              href={`/admin/sci-fi/${s.id}`}
              className="truncate font-medium hover:underline"
            >
              {s.title}
            </Link>
            <span className="text-xs text-muted">
              {s.authorName} · {Math.max(1, Math.round(Number(s.chars) / 1400))}{" "}
              min · edited{" "}
              {new Date(s.updatedAt).toLocaleDateString("en-US", {
                dateStyle: "medium",
              })}
            </span>
          </span>
          <span
            className={`inline-flex h-6 items-center border px-2 font-mono text-[10px] uppercase tracking-[0.14em] ${s.status === "published" || s.status === "scheduled" ? "border-signal/60 text-signal-ink" : "border-line text-muted"}`}
          >
            {s.status === "scheduled" && s.publishAt
              ? `Scheduled ${new Date(s.publishAt).toLocaleDateString("en-US", { dateStyle: "medium" })}`
              : s.status}
          </span>
        </li>
      ))}
    </ul>
  );
}
