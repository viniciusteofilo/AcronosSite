import type { Database } from "@/db/client";
import { emailLog, EMAIL_KINDS } from "@/db/schema";
import { isTestEnvironment } from "@/lib/site-url";

export type EmailKind = (typeof EMAIL_KINDS)[number];
export type EmailMessage = { kind: EmailKind; to: string; subject: string; html: string; text: string; replyTo?: string; ref?: string };

/**
 * provider: a real e-mail service is configured (Resend, free plan available).
 * outbox: no provider, but this is the test environment or development: messages are kept in the
 *         admin (E-mails) marked "not sent", so every flow can be tried without sending anything.
 * off:    no provider in production: nothing is sent and screens that depend on e-mail say so.
 */
export type EmailMode = "provider" | "outbox" | "off";

export function emailMode(): EmailMode {
  if (process.env.RESEND_API_KEY && process.env.EMAIL_FROM) return "provider";
  if (isTestEnvironment() || process.env.NODE_ENV !== "production") return "outbox";
  return "off";
}

/** True when a person can actually receive the message (or see it in the test outbox). */
export const emailAvailable = () => emailMode() !== "off";

async function sendWithResend(m: EmailMessage): Promise<{ id: string }> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [m.to], subject: m.subject, html: m.html, text: m.text, reply_to: m.replyTo }),
    signal: AbortSignal.timeout(10_000),
  });
  const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
  if (!res.ok || !body.id) throw new Error(`Resend ${res.status}: ${body.message ?? "error"}`.slice(0, 300));
  return { id: body.id };
}

/**
 * Sends one e-mail and records it. Never throws: a failed e-mail must not undo a payment,
 * an order update or a sign-up. Failures stay visible in the admin.
 */
export async function sendEmail(db: Database, m: EmailMessage): Promise<"sent" | "failed" | "not_sent"> {
  const mode = emailMode();
  const base = { kind: m.kind, to: m.to.toLowerCase(), subject: m.subject, ref: m.ref ?? null };
  try {
    if (mode === "provider") {
      try {
        const { id } = await sendWithResend(m);
        await db.insert(emailLog).values({ ...base, status: "sent", provider: "resend", providerId: id });
        return "sent";
      } catch (e) {
        await db.insert(emailLog).values({ ...base, status: "failed", provider: "resend", error: e instanceof Error ? e.message : "error" });
        return "failed";
      }
    }
    const keepBody = mode === "outbox";
    await db.insert(emailLog).values({ ...base, status: "not_sent", bodyHtml: keepBody ? m.html : null, bodyText: keepBody ? m.text : null });
    return "not_sent";
  } catch (e) {
    console.error("[email] could not record e-mail", e);
    return "failed";
  }
}
