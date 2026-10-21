"use server";

import { getDb } from "@/db/client";
import { getAccessContext } from "@/server/auth";
import { runAdmin } from "@/server/admin/errors";
import { grantRoleByEmail, revokeStaffRole, setMessageStatus, unsubscribe } from "@/server/admin/people";
import { getPageRevision, savePage } from "@/server/content/pages-admin";
import {
  createStoryCategory,
  deleteLabItem,
  deleteStory,
  getStoryForEditor,
  getStoryRevision,
  saveLabProject,
  saveLabUpdate,
  saveStory,
} from "@/server/content/stories-admin";

// Content and people actions. Each one re-checks session, role, two-factor and permission.

export async function savePageAction(input: unknown) {
  return runAdmin(async () => savePage(getDb(), await getAccessContext(), input), "Saved.");
}

export async function loadPageRevisionAction(slug: string, revisionId: string) {
  return runAdmin(async () => getPageRevision(getDb(), await getAccessContext(), slug, revisionId), "Old version loaded. Save to keep it.");
}

export async function saveStoryAction(input: unknown) {
  return runAdmin(async () => {
    const db = getDb();
    const ctx = await getAccessContext();
    const saved = await saveStory(db, ctx, input);
    return { ...saved, story: await getStoryForEditor(db, ctx, saved.id) };
  }, "Saved.");
}

export async function loadStoryRevisionAction(storyId: string, revisionId: string) {
  return runAdmin(async () => getStoryRevision(getDb(), await getAccessContext(), storyId, revisionId), "Old version loaded. Save to keep it.");
}

export async function deleteStoryAction(id: string) {
  return runAdmin(async () => deleteStory(getDb(), await getAccessContext(), id), "Story deleted.");
}

export async function createStoryCategoryAction(input: unknown) {
  return runAdmin(async () => createStoryCategory(getDb(), await getAccessContext(), input), "Category added.");
}

export async function saveLabProjectAction(input: unknown) {
  return runAdmin(async () => saveLabProject(getDb(), await getAccessContext(), input), "Project saved.");
}

export async function saveLabUpdateAction(input: unknown) {
  return runAdmin(async () => saveLabUpdate(getDb(), await getAccessContext(), input), "Update saved.");
}

export async function deleteLabItemAction(kind: "project" | "update", id: string) {
  return runAdmin(async () => deleteLabItem(getDb(), await getAccessContext(), kind, id), "Deleted.");
}

export async function setMessageStatusAction(id: string, status: string) {
  return runAdmin(async () => setMessageStatus(getDb(), await getAccessContext(), id, status), "Updated.");
}

export async function unsubscribeAction(id: string) {
  return runAdmin(async () => unsubscribe(getDb(), await getAccessContext(), id), "Unsubscribed.");
}

export async function grantRoleAction(input: unknown) {
  return runAdmin(async () => grantRoleByEmail(getDb(), await getAccessContext(), input), "Role added. The person must turn on two-factor before using the admin.");
}

export async function revokeRoleAction(input: unknown) {
  return runAdmin(async () => revokeStaffRole(getDb(), await getAccessContext(), input), "Role removed.");
}
