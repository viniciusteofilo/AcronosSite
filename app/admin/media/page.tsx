import type { Metadata } from "next";
import { Suspense } from "react";
import { getDb } from "@/db/client";
import { MediaManager } from "@/components/admin/media-manager";
import { requireStaff } from "@/server/auth";
import { listMedia } from "@/server/media/library";
import { updateMediaAction } from "../site/actions";

export const metadata: Metadata = { title: "Image library" };

export default function MediaPage() {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-xl uppercase tracking-[0.08em]">Image library</h1>
        <p className="max-w-2xl text-sm text-muted">
          Every photo uploaded to the site. Upload in bulk here, then use them in the site editor and in products.
        </p>
      </header>
      <Suspense fallback={<p className="text-muted">Loading…</p>}>
        <Library />
      </Suspense>
    </div>
  );
}

async function Library() {
  const ctx = await requireStaff("content:write");
  const items = await listMedia(getDb(), ctx, 300);
  return (
    <MediaManager
      initial={items.map((m) => ({ ...m, createdAt: m.createdAt.toISOString() }))}
      updateMedia={updateMediaAction}
    />
  );
}
