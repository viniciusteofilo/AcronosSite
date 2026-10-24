import { z } from "zod";
import type { Database } from "@/db/client";
import { newsletterSubscribers, supportRequests } from "@/db/schema";
import { takeRateLimit } from "@/server/security/rate-limit";

export type FormResult =
  | { ok: true; message: string }
  | { ok: false; message: string; field?: string; values?: Record<string, string> };

/** Echo back what the person typed (never secrets) so a validation error does not wipe the form. */
function echo(form: FormData, keys: string[]): Record<string, string> {
  return Object.fromEntries(keys.map((k) => [k, String(form.get(k) ?? "").slice(0, 4000)]));
}

const newsletterInput = z.object({
  email: z.email().max(254),
  consent: z.literal("on", { error: "Please confirm you want to receive e-mails." }),
  website: z.string().max(0).optional(), // honeypot: real people never fill it
  source: z.string().max(40).default("footer"),
});

/**
 * Records a newsletter sign-up with its consent (source and time). The address stays
 * "pending" until confirmed by e-mail (double opt-in); confirmation e-mails are sent once
 * the e-mail provider is connected. No message is ever sent without that confirmation.
 */
export async function subscribeNewsletter(db: Database, form: FormData, ipHash: string): Promise<FormResult> {
  if (!(await takeRateLimit(db, `newsletter:${ipHash}`, 5, 600))) {
    return { ok: false, message: "Too many attempts. Try again in a few minutes." };
  }
  const parsed = newsletterInput.safeParse(Object.fromEntries(form));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    if (issue?.path[0] === "website") return { ok: true, message: "Thanks. We will e-mail you to confirm before sending any newsletter." };
    return {
      ok: false,
      field: String(issue?.path[0] ?? "email"),
      message: issue?.path[0] === "consent" ? "Please confirm you want to receive e-mails." : "Enter a valid e-mail address.",
      values: echo(form, ["email"]),
    };
  }
  const { email, source } = parsed.data;
  await db
    .insert(newsletterSubscribers)
    .values({ email: email.toLowerCase(), status: "pending", consentSource: source, consentAt: new Date() })
    .onConflictDoNothing();
  // Same answer whether or not the address already existed: the form never reveals who is subscribed.
  return { ok: true, message: "Thanks. We will e-mail you to confirm before sending any newsletter." };
}

const contactInput = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.email().max(254),
  topic: z.enum(["order", "product", "wholesale", "press", "lab", "other"]),
  message: z.string().trim().min(10).max(4000),
  website: z.string().max(0).optional(),
});

export async function submitContact(db: Database, form: FormData, ipHash: string, userId: string | null): Promise<FormResult> {
  if (!(await takeRateLimit(db, `contact:${ipHash}`, 3, 600))) {
    return { ok: false, message: "Too many messages. Try again in a few minutes." };
  }
  const parsed = contactInput.safeParse(Object.fromEntries(form));
  if (!parsed.success) {
    const field = String(parsed.error.issues[0]?.path[0] ?? "message");
    if (field === "website") return { ok: true, message: "Thanks. We received your message." };
    const messages: Record<string, string> = {
      name: "Enter your name.",
      email: "Enter a valid e-mail address.",
      topic: "Choose a topic.",
      message: "Write a message of at least 10 characters.",
    };
    return { ok: false, field, message: messages[field] ?? "Check the form and try again.", values: echo(form, ["name", "email", "topic", "message"]) };
  }
  const { website: _honeypot, ...data } = parsed.data;
  void _honeypot;
  await db.insert(supportRequests).values({ ...data, email: data.email.toLowerCase(), userId });
  return { ok: true, message: "Thanks. We received your message and will reply by e-mail." };
}
