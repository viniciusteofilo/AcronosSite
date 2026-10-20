"use server";

import { getDb } from "@/db/client";
import { getAccessContext } from "@/server/auth";
import {
  cancelHomeSchedule,
  discardHomeDraft,
  publishHome,
  restoreHomeRevision,
  saveHomeDraft,
  scheduleHome,
} from "@/server/content/home";
import { listMedia, updateMediaAsset } from "@/server/media/library";

export type ActionResult = { ok: true; message: string } | { ok: false; message: string };

/** Every action re-checks the session, role, MFA and permission on the server. */
async function run(fn: () => Promise<unknown>, success: string): Promise<ActionResult> {
  try {
    await fn();
    return { ok: true, message: success };
  } catch (e) {
    if (e instanceof Error && e.name === "ZodError") return { ok: false, message: "Some fields are not valid. Check links and lengths." };
    if (e instanceof Error && e.name === "AccessDeniedError") return { ok: false, message: "Your session expired or you do not have access. Sign in again." };
    return { ok: false, message: e instanceof Error ? e.message : "Something went wrong." };
  }
}

export async function saveDraftAction(blocks: unknown) {
  return run(async () => saveHomeDraft(getDb(), await getAccessContext(), blocks), "Draft saved.");
}

export async function publishAction(blocks: unknown) {
  return run(async () => {
    const db = getDb();
    const ctx = await getAccessContext();
    await saveHomeDraft(db, ctx, blocks);
    await publishHome(db, ctx);
  }, "Published. The homepage is updated.");
}

export async function scheduleAction(blocks: unknown, atIso: string) {
  return run(async () => {
    const db = getDb();
    const ctx = await getAccessContext();
    await saveHomeDraft(db, ctx, blocks);
    await scheduleHome(db, ctx, atIso);
  }, "Scheduled. It goes live automatically at the chosen time.");
}

export async function cancelScheduleAction() {
  return run(async () => cancelHomeSchedule(getDb(), await getAccessContext()), "Schedule cancelled. The campaign is back in your draft.");
}

export async function discardDraftAction() {
  return run(async () => discardHomeDraft(getDb(), await getAccessContext()), "Draft discarded.");
}

export async function restoreRevisionAction(revisionId: string) {
  return run(async () => restoreHomeRevision(getDb(), await getAccessContext(), revisionId), "Version loaded into the draft. Publish to make it live.");
}

export async function updateMediaAction(input: { id: string; alt?: string; focalX?: number; focalY?: number }) {
  return run(async () => updateMediaAsset(getDb(), await getAccessContext(), input), "Image updated.");
}

export async function listMediaAction() {
  return listMedia(getDb(), await getAccessContext());
}
