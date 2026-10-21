import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getDb } from "@/db/client";
import { AdminPageHeader } from "@/components/admin/page-header";
import { StoryEditor } from "@/components/admin/story-editor";
import { requireStaff } from "@/server/auth";
import {
  getStoryForEditor,
  listStoryCategories,
} from "@/server/content/stories-admin";
import {
  createStoryCategoryAction,
  deleteStoryAction,
  loadStoryRevisionAction,
  saveStoryAction,
} from "../../pages/actions";
import { listMediaAction, updateMediaAction } from "../../site/actions";

export const metadata: Metadata = { title: "Edit story" };

const actions = {
  save: saveStoryAction,
  remove: deleteStoryAction,
  loadRevision: loadStoryRevisionAction,
  createCategory: createStoryCategoryAction,
  updateMedia: updateMediaAction,
  listMedia: listMediaAction,
};

export default function EditStoryPage({
  params,
}: PageProps<"/admin/sci-fi/[id]">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <Editor params={params} />
    </Suspense>
  );
}

async function Editor({
  params,
}: Pick<PageProps<"/admin/sci-fi/[id]">, "params">) {
  const ctx = await requireStaff("content:write");
  const { id } = await params;
  const db = getDb();
  const [story, categories] = await Promise.all([
    getStoryForEditor(db, ctx, id),
    listStoryCategories(db, ctx),
  ]);
  if (!story) notFound();
  return (
    <div className="flex flex-col gap-4">
      <AdminPageHeader
        title={story.title}
        back={{ href: "/admin/sci-fi", label: "Sci-Fi" }}
      />
      <StoryEditor
        key={`${story.id}:${story.updatedAt}`}
        story={story}
        categories={categories}
        actions={actions}
      />
    </div>
  );
}
