import { and, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "@/db/client";
import {
  accounts,
  addresses,
  carts,
  newsletterSubscribers,
  orderItems,
  orders,
  privacyRequests,
  sessions,
  supportRequests,
  twoFactors,
  userRoles,
  users,
} from "@/db/schema";
import { UserError, authorize } from "@/server/admin/errors";
import { recordAudit } from "@/server/audit/log";
import type { AccessContext } from "@/server/rbac/access";

function signedIn(ctx: AccessContext | null): AccessContext {
  if (!ctx) throw new UserError("Sign in first.");
  return ctx;
}

/** Short, readable description of a browser from its user agent (no fingerprinting). */
export function describeAgent(ua: string | null): string {
  if (!ua) return "Unknown device";
  const browser = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Browser";
  const os = /iPhone|iPad/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Mac OS X/.test(ua) ? "macOS" : /Windows/.test(ua) ? "Windows" : /Linux/.test(ua) ? "Linux" : "";
  return [browser, os].filter(Boolean).join(" on ");
}

// ---------------------------------------------------------------- sessions

export async function listMySessions(db: Database, actor: AccessContext | null) {
  const ctx = signedIn(actor);
  const rows = await db
    .select({ id: sessions.id, createdAt: sessions.createdAt, updatedAt: sessions.updatedAt, ipAddress: sessions.ipAddress, userAgent: sessions.userAgent, expiresAt: sessions.expiresAt })
    .from(sessions)
    .where(and(eq(sessions.userId, ctx.userId), sql`${sessions.expiresAt} > now()`))
    .orderBy(desc(sessions.updatedAt));
  return rows.map((r) => ({
    id: r.id,
    current: r.id === ctx.sessionId,
    device: describeAgent(r.userAgent),
    ipAddress: r.ipAddress,
    createdAt: r.createdAt.toISOString(),
    lastActive: r.updatedAt.toISOString(),
  }));
}

/** Ends every other session of this account (e.g. a lost phone). Takes effect immediately. */
export async function endOtherSessions(db: Database, actor: AccessContext | null) {
  const ctx = signedIn(actor);
  if (!ctx.sessionId) throw new UserError("Sign in again and retry.");
  const ended = await db.delete(sessions).where(and(eq(sessions.userId, ctx.userId), ne(sessions.id, ctx.sessionId))).returning({ id: sessions.id });
  await recordAudit(db, { actorId: ctx.userId, action: "session.end_others", entityType: "user", entityId: ctx.userId, after: { ended: ended.length } });
  return ended.length;
}

export async function endSession(db: Database, actor: AccessContext | null, sessionId: string) {
  const ctx = signedIn(actor);
  const id = z.uuid().parse(sessionId);
  if (id === ctx.sessionId) throw new UserError("To end this session, sign out.");
  const [row] = await db.delete(sessions).where(and(eq(sessions.id, id), eq(sessions.userId, ctx.userId))).returning({ id: sessions.id });
  if (!row) throw new UserError("Session not found.");
  await recordAudit(db, { actorId: ctx.userId, action: "session.end", entityType: "user", entityId: ctx.userId });
}

// ---------------------------------------------------------------- privacy (LGPD / GDPR / CCPA)

/** Everything ACRONOS stores about the signed-in person, as one JSON document. Never includes secrets. */
export async function exportMyData(db: Database, actor: AccessContext | null) {
  const ctx = signedIn(actor);
  const [u] = await db.select({ name: users.name, email: users.email, emailVerified: users.emailVerified, twoFactorEnabled: users.twoFactorEnabled, createdAt: users.createdAt }).from(users).where(eq(users.id, ctx.userId));
  const [addr, ords, subs, msgs, reqs] = await Promise.all([
    db.select({ fullName: addresses.fullName, line1: addresses.line1, line2: addresses.line2, city: addresses.city, region: addresses.region, postalCode: addresses.postalCode, country: addresses.country, phone: addresses.phone }).from(addresses).where(eq(addresses.userId, ctx.userId)),
    db.select().from(orders).where(eq(orders.userId, ctx.userId)).orderBy(desc(orders.createdAt)),
    db.select({ email: newsletterSubscribers.email, status: newsletterSubscribers.status, consentSource: newsletterSubscribers.consentSource, consentAt: newsletterSubscribers.consentAt }).from(newsletterSubscribers).where(eq(newsletterSubscribers.email, u.email.toLowerCase())),
    db.select({ topic: supportRequests.topic, message: supportRequests.message, createdAt: supportRequests.createdAt }).from(supportRequests).where(sql`lower(${supportRequests.email}) = lower(${u.email})`),
    db.select({ kind: privacyRequests.kind, status: privacyRequests.status, createdAt: privacyRequests.createdAt }).from(privacyRequests).where(eq(privacyRequests.userId, ctx.userId)),
  ]);
  const items = ords.length ? await db.select().from(orderItems).where(inArray(orderItems.orderId, ords.map((o) => o.id))) : [];
  await recordAudit(db, { actorId: ctx.userId, action: "privacy.export_self", entityType: "user", entityId: ctx.userId });
  return {
    generatedAt: new Date().toISOString(),
    controller: "ACRONOS",
    account: u,
    addresses: addr,
    orders: ords.map((o) => ({
      number: o.number,
      createdAt: o.createdAt,
      currency: o.currency,
      totalMinor: o.totalMinor,
      paymentStatus: o.paymentStatus,
      fulfillmentStatus: o.fulfillmentStatus,
      shippingAddress: o.shippingAddress,
      items: items.filter((i) => i.orderId === o.id).map((i) => ({ productName: i.productName, sku: i.sku, size: i.size, color: i.color, unitPriceMinor: i.unitPriceMinor, quantity: i.quantity })),
    })),
    newsletter: subs,
    messages: msgs,
    privacyRequests: reqs,
  };
}

export async function requestAccountDeletion(db: Database, actor: AccessContext | null) {
  const ctx = signedIn(actor);
  if (ctx.roles.length) throw new UserError("Staff accounts are removed by a super admin in Users first.");
  const [open] = await db
    .select({ id: privacyRequests.id })
    .from(privacyRequests)
    .where(and(eq(privacyRequests.userId, ctx.userId), eq(privacyRequests.kind, "delete"), inArray(privacyRequests.status, ["received", "in_progress"])))
    .limit(1);
  if (open) return { alreadyRequested: true };
  await db.insert(privacyRequests).values({ userId: ctx.userId, email: ctx.email, kind: "delete" });
  await recordAudit(db, { actorId: ctx.userId, action: "privacy.delete_requested", entityType: "user", entityId: ctx.userId });
  return { alreadyRequested: false };
}

export async function listPrivacyRequests(db: Database, actor: AccessContext | null) {
  authorize(actor, "privacy:handle");
  const rows = await db.select().from(privacyRequests).orderBy(desc(privacyRequests.createdAt)).limit(300);
  return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString(), completedAt: r.completedAt?.toISOString() ?? null }));
}

/**
 * Erases a customer's personal data. Orders stay (tax and accounting law requires keeping
 * sales records), but the account, sign-in methods, addresses, carts, newsletter consent and
 * messages are removed and the profile is anonymized.
 */
export async function completeDeletion(db: Database, actor: AccessContext | null, requestId: string) {
  const ctx = authorize(actor, "privacy:handle");
  await db.transaction(async (tx) => {
    const [req] = await tx.select().from(privacyRequests).where(eq(privacyRequests.id, z.uuid().parse(requestId))).for("update");
    if (!req || req.kind !== "delete") throw new UserError("Request not found.");
    if (req.status === "completed") return;
    if (req.userId) {
      const [staff] = await tx.select({ r: userRoles.role }).from(userRoles).where(eq(userRoles.userId, req.userId)).limit(1);
      if (staff) throw new UserError("This person has a staff role. Remove it in Users first.");
      const [u] = await tx.select({ email: users.email }).from(users).where(eq(users.id, req.userId));
      for (const t of [sessions, accounts, twoFactors, addresses, carts] as const) await tx.delete(t).where(eq(t.userId, req.userId));
      if (u) {
        await tx.delete(newsletterSubscribers).where(eq(newsletterSubscribers.email, u.email.toLowerCase()));
        await tx.delete(supportRequests).where(sql`lower(${supportRequests.email}) = lower(${u.email})`);
      }
      await tx
        .update(users)
        .set({ name: "Deleted customer", email: `deleted-${req.userId}@deleted.invalid`, emailVerified: false, image: null, twoFactorEnabled: false, updatedAt: new Date() })
        .where(eq(users.id, req.userId));
    }
    await tx.update(privacyRequests).set({ status: "completed", handledBy: ctx.userId, completedAt: new Date(), email: "redacted", updatedAt: new Date() }).where(eq(privacyRequests.id, req.id));
    await recordAudit(tx, { actorId: ctx.userId, action: "privacy.delete_completed", entityType: "user", entityId: req.userId });
  });
}

export async function rejectPrivacyRequest(db: Database, actor: AccessContext | null, requestId: string) {
  const ctx = authorize(actor, "privacy:handle");
  const [row] = await db.update(privacyRequests).set({ status: "rejected", handledBy: ctx.userId, updatedAt: new Date() }).where(eq(privacyRequests.id, z.uuid().parse(requestId))).returning({ id: privacyRequests.id });
  if (!row) throw new UserError("Request not found.");
  await recordAudit(db, { actorId: ctx.userId, action: "privacy.rejected", entityType: "privacy_request", entityId: requestId });
}
