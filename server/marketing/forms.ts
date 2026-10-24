import { eq } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "@/db/client";
import { newsletterSubscribers, supportRequests } from "@/db/schema";
import { notifyContact, sendNewsletterConfirmation } from "@/server/email/notify";
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
 * "pending" until the person clicks the link in the confirmation e-mail (double opt-in).
 * No newsletter is ever sent to an address without that confirmation.
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
  const address = email.toLowerCase();
  await db
    .insert(newsletterSubscribers)
    .values({ email: address, status: "pending", consentSource: source, consentAt: new Date() })
    .onConflictDoNothing();
  // confirmation e-mail unless already confirmed; someone who unsubscribed can sign up again
  const [row] = await db.select({ status: newsletterSubscribers.status }).from(newsletterSubscribers).where(eq(newsletterSubscribers.email, address)).limit(1);
  if (row && row.status !== "confirmed") {
    if (row.status === "unsubscribed") {
      await db.update(newsletterSubscribers).set({ status: "pending", consentSource: source, consentAt: new Date(), unsubscribedAt: null, updatedAt: new Date() }).where(eq(newsletterSubscribers.email, address));
    }
    await sendNewsletterConfirmation(db, address);
  }
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
  const [saved] = await db.insert(supportRequests).values({ ...data, email: data.email.toLowerCase(), userId }).returning({ id: supportRequests.id });
  await notifyContact(db, { ...data, id: saved.id });
  return { ok: true, message: "Thanks. We received your message and will reply by e-mail." };
}
