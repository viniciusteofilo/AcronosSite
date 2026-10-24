"use server";

import { getDb } from "@/db/client";
import { runAdmin } from "@/server/admin/errors";
import { getAccessContext } from "@/server/auth";
import { sendTestEmail } from "@/server/email/admin";
import { saveStoreSettings } from "@/server/store/settings";

export async function sendTestEmailAction() {
  const db = getDb();
  const ctx = await getAccessContext();
  let message = "";
  const r = await runAdmin(async () => {
    message = await sendTestEmail(db, ctx);
  }, "ok");
  return r.ok ? { ...r, message } : r;
}

export async function saveNotifyEmailAction(notifyEmail: string) {
  return runAdmin(async () => saveStoreSettings(getDb(), await getAccessContext(), { notifyEmail }), "Saved.");
}
