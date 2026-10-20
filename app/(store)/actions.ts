"use server";

import { getDb } from "@/db/client";
import { getAccessContext } from "@/server/auth";
import { submitContact, subscribeNewsletter, type FormResult } from "@/server/marketing/forms";
import { clientIp, hashIp } from "@/server/security/request";

export async function newsletterAction(_prev: FormResult | null, form: FormData): Promise<FormResult> {
  return subscribeNewsletter(getDb(), form, hashIp(await clientIp()));
}

export async function contactAction(_prev: FormResult | null, form: FormData): Promise<FormResult> {
  const ctx = await getAccessContext();
  return submitContact(getDb(), form, hashIp(await clientIp()), ctx?.userId ?? null);
}
