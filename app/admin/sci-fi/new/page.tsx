import type { Metadata } from "next";

import { Suspense } from "react";
import { getDb } from "@/db/client";
import { FreshOnNavigate } from "@/components/admin/fresh-on-navigate";
import { AdminPageHeader } from "@/components/admin/page-header";
import { StoryEditor } from "@/components/admin/story-editor";
import { requireStaff } from "@/server/auth";
import { listStoryCategories } from "@/server/content/stories-admin";
import {
  createStoryCategoryAction,
  deleteStoryAction,
  loadStoryRevisionAction,
  saveStoryAction,
} from "../../pages/actions";
import { listMediaAction, updateMediaAction } from "../../site/actions";

export const metadata: Metadata = { title: "New story" };

const actions = {
  save: saveStoryAction,
  remove: deleteStoryAction,
  loadRevision: loadStoryRevisionAction,
  createCategory: createStoryCategoryAction,
  updateMedia: updateMediaAction,
  listMedia: listMediaAction,
};

export default function NewStoryPage() {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <Editor />
    </Suspense>
  );
}

async function Editor() {
  const ctx = await requireStaff("content:write");
  const categories = await listStoryCategories(getDb(), ctx);
  return (
    <div className="flex flex-col gap-4">
      <AdminPageHeader
        title="New story"
        back={{ href: "/admin/sci-fi", label: "Sci-Fi" }}
      />
      <FreshOnNavigate>
        <StoryEditor story={null} categories={categories} actions={actions} />
      </FreshOnNavigate>
    </div>
  );
}
