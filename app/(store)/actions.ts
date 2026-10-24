"use server";

import { getDb } from "@/db/client";
import { getAccessContext } from "@/server/auth";
import { submitContact, subscribeNewsletter, type FormResult } from "@/server/marketing/forms";
import { clientIp, hashIp } from "@/server/security/request";
import { HUMAN_CHECK_MESSAGE, verifyTurnstile } from "@/server/security/turnstile";

export async function newsletterAction(_prev: FormResult | null, form: FormData): Promise<FormResult> {
  const ip = await clientIp();
  if (!(await verifyTurnstile(form.get("cf-turnstile-response"), ip))) return { ok: false, message: HUMAN_CHECK_MESSAGE, values: { email: String(form.get("email") ?? "").slice(0, 254) } };
  return subscribeNewsletter(getDb(), form, hashIp(ip));
}

export async function contactAction(_prev: FormResult | null, form: FormData): Promise<FormResult> {
  const ip = await clientIp();
  if (!(await verifyTurnstile(form.get("cf-turnstile-response"), ip))) {
    const values = Object.fromEntries(["name", "email", "topic", "message"].map((k) => [k, String(form.get(k) ?? "").slice(0, 4000)]));
    return { ok: false, message: HUMAN_CHECK_MESSAGE, values };
  }
  const ctx = await getAccessContext();
  return submitContact(getDb(), form, hashIp(ip), ctx?.userId ?? null);
}
