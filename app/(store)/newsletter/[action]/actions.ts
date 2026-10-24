"use server";

import { getDb } from "@/db/client";
import { applyNewsletterLink } from "@/server/email/notify";

export async function newsletterLinkAction(_prev: unknown, form: FormData): Promise<{ ok: boolean; message: string }> {
  const purpose = form.get("purpose") === "unsubscribe" ? "unsubscribe" : "confirm";
  const r = await applyNewsletterLink(getDb(), String(form.get("t") ?? ""), purpose);
  if (r === "invalid") return { ok: false, message: "This link is not valid or has expired." };
  return { ok: true, message: purpose === "confirm" ? "Subscription confirmed. Thank you." : "You are unsubscribed. You will not receive more newsletters." };
}
