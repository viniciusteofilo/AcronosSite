import { and, count, desc, eq } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "@/db/client";
import { emailLog, EMAIL_KINDS } from "@/db/schema";
import { UserError, authorize } from "@/server/admin/errors";
import type { AccessContext } from "@/server/rbac/access";
import { emailMode, sendEmail } from "./send";

export const EMAIL_KIND_LABELS: Record<(typeof EMAIL_KINDS)[number], string> = {
  verify_email: "Confirm e-mail",
  reset_password: "Password reset",
  password_changed: "Password changed",
  order_confirmation: "Order confirmed",
  order_shipped: "Order shipped",
  order_refunded: "Refund",
  newsletter_confirm: "Newsletter confirmation",
  contact_notification: "New message (team)",
  staff_sign_in: "Staff sign-in alert",
  test: "Test",
};

/** E-mail log for the owner. Message bodies exist only in the test outbox (never with a real provider). */
export async function listEmails(db: Database, actor: AccessContext | null, raw: { kind?: string; page?: string | number }, pageSize = 50) {
  authorize(actor, "settings:manage");
  const kind = z.enum(EMAIL_KINDS).optional().catch(undefined).parse(raw.kind);
  const page = Math.max(1, Number(raw.page) || 1);
  const where = kind ? eq(emailLog.kind, kind) : undefined;
  const [rows, [{ total }]] = await Promise.all([
    db
      .select({ id: emailLog.id, kind: emailLog.kind, to: emailLog.to, subject: emailLog.subject, status: emailLog.status, error: emailLog.error, createdAt: emailLog.createdAt, hasBody: emailLog.bodyHtml })
      .from(emailLog)
      .where(where)
      .orderBy(desc(emailLog.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ total: count() }).from(emailLog).where(where),
  ]);
  return { kind: kind ?? null, page, pages: Math.max(1, Math.ceil(total / pageSize)), items: rows.map((r) => ({ ...r, hasBody: !!r.hasBody, createdAt: r.createdAt.toISOString() })) };
}

export async function getEmail(db: Database, actor: AccessContext | null, id: string) {
  authorize(actor, "settings:manage");
  if (!z.uuid().safeParse(id).success) return null;
  const [row] = await db.select().from(emailLog).where(and(eq(emailLog.id, id))).limit(1);
  return row ?? null;
}

export async function sendTestEmail(db: Database, actor: AccessContext | null) {
  const ctx = authorize(actor, "settings:manage");
  const { layoutTest } = await import("./templates");
  const r = await sendEmail(db, { kind: "test", to: ctx.email, ...layoutTest() });
  if (r === "failed") throw new UserError("The provider did not accept the e-mail. See the error in the list.");
  return emailMode() === "provider" ? `Test e-mail sent to ${ctx.email}.` : "Recorded in the list below (not sent: no e-mail provider connected).";
}
