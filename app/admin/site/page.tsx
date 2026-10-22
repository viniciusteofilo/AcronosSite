import type { Metadata } from "next";
import { Suspense } from "react";
import { getDb } from "@/db/client";
import { HomeEditor } from "@/components/admin/home-editor";
import { requireStaff } from "@/server/auth";
import { listProducts, shopFilterSchema } from "@/server/catalog/queries";
import { getHomeEditorState } from "@/server/content/home";
import {
  cancelScheduleAction,
  discardDraftAction,
  listMediaAction,
  publishAction,
  restoreRevisionAction,
  saveDraftAction,
  scheduleAction,
  updateMediaAction,
} from "./actions";

export const metadata: Metadata = { title: "Site editor" };

export default function SiteEditorPage() {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-xl uppercase tracking-[0.08em]">Site editor · Homepage</h1>
        <p className="max-w-2xl text-sm text-muted">
          Change the campaign photos and texts. Changes stay in a draft until you publish or schedule them.
        </p>
      </header>
      <Suspense fallback={<p className="text-muted">Loading editor…</p>}>
        <Editor />
      </Suspense>
    </div>
  );
}

async function Editor() {
  const ctx = await requireStaff("content:write");
  const db = getDb();
  const [state, catalog] = await Promise.all([
    getHomeEditorState(db, ctx),
    listProducts(db, shopFilterSchema.parse({}), { limit: 200 }),
  ]);
  return (
    <HomeEditor
      initial={state.draft}
      initialMedia={Object.fromEntries(state.media)}
      hasDraft={state.hasDraft}
      scheduledAt={state.scheduledAt?.toISOString() ?? null}
      revisions={state.revisions.map((r) => ({ id: r.id, createdAt: r.createdAt.toISOString() }))}
      products={catalog.items.map((p) => ({ id: p.id, name: p.name }))}
      initialFilm={state.film}
      actions={{
        save: saveDraftAction,
        publish: publishAction,
        schedule: scheduleAction,
        cancelSchedule: cancelScheduleAction,
        discard: discardDraftAction,
        restore: restoreRevisionAction,
        updateMedia: updateMediaAction,
        listMedia: listMediaAction,
      }}
    />
  );
}
