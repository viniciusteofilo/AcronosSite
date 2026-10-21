import { and, asc, desc, eq, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "@/db/client";
import { addresses, newsletterSubscribers, orders, ROLE_KEYS, sessions, supportRequests, twoFactors, userRoles, users, type RoleKey } from "@/db/schema";
import { recordAudit } from "@/server/audit/log";
import type { AccessContext } from "@/server/rbac/access";
import { hasPermission } from "@/server/rbac/permissions";
import { grantRole, revokeRole } from "@/server/rbac/roles";
import { UserError, authorize } from "./errors";

const like = (q: string) => `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

// ---------------------------------------------------------------- customers

export async function listCustomers(db: Database, actor: AccessContext | null, raw: { q?: string; page?: string | number }, pageSize = 50) {
  authorize(actor, "customers:read");
  const f = z.object({ q: z.string().trim().max(120).optional(), page: z.coerce.number().int().min(1).max(10_000).default(1) }).parse(raw);
  const where: SQL[] = [sql`NOT EXISTS (SELECT 1 FROM ${userRoles} ur WHERE ur.user_id = "users"."id")`];
  if (f.q) where.push(sql`(${users.email} ILIKE ${like(f.q)} OR ${users.name} ILIKE ${like(f.q)})`);
  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      createdAt: users.createdAt,
      orders: sql<number>`(SELECT count(*)::int FROM ${orders} o WHERE o.user_id = "users"."id")`,
      paid: sql<{ currency: string; total: number }[]>`coalesce((SELECT json_agg(t) FROM (SELECT o.currency, sum(o.total_minor)::int AS total FROM ${orders} o
        WHERE o.user_id = "users"."id" AND o.payment_status IN ('paid','partially_refunded') GROUP BY o.currency) t), '[]'::json)`,
      newsletter: sql<string | null>`(SELECT n.status FROM ${newsletterSubscribers} n WHERE n.email = lower("users"."email"))`,
      total: sql<number>`count(*) OVER ()`,
    })
    .from(users)
    .where(and(...where))
    .orderBy(desc(users.createdAt))
    .limit(pageSize)
    .offset((f.page - 1) * pageSize);
  const total = Number(rows[0]?.total ?? 0);
  return {
    filter: f,
    total,
    pages: Math.max(1, Math.ceil(total / pageSize)),
    items: rows.map((r) => ({ id: r.id, name: r.name, email: r.email, orders: r.orders, paid: r.paid, newsletter: r.newsletter, createdAt: r.createdAt.toISOString() })),
  };
}

/** Customer detail. Addresses are only returned to roles allowed to see shipping data. */
export async function getCustomer(db: Database, actor: AccessContext | null, id: string) {
  const ctx = authorize(actor, "customers:read");
  if (!z.uuid().safeParse(id).success) return null;
  const [u] = await db.select({ id: users.id, name: users.name, email: users.email, createdAt: users.createdAt, emailVerified: users.emailVerified }).from(users).where(eq(users.id, id)).limit(1);
  if (!u) return null;
  const canSeeAddresses = hasPermission(ctx.roles, "customers:read_shipping");
  const [orderRows, addressRows, sub, messages] = await Promise.all([
    db
      .select({ id: orders.id, number: orders.number, currency: orders.currency, totalMinor: orders.totalMinor, paymentStatus: orders.paymentStatus, fulfillmentStatus: orders.fulfillmentStatus, createdAt: orders.createdAt })
      .from(orders)
      .where(eq(orders.userId, id))
      .orderBy(desc(orders.createdAt))
      .limit(100),
    canSeeAddresses ? db.select().from(addresses).where(eq(addresses.userId, id)) : Promise.resolve([]),
    db.select({ status: newsletterSubscribers.status, consentAt: newsletterSubscribers.consentAt }).from(newsletterSubscribers).where(eq(newsletterSubscribers.email, u.email.toLowerCase())).limit(1),
    db.select({ id: supportRequests.id, topic: supportRequests.topic, status: supportRequests.status, createdAt: supportRequests.createdAt }).from(supportRequests).where(sql`lower(${supportRequests.email}) = lower(${u.email})`).orderBy(desc(supportRequests.createdAt)),
  ]);
  await recordAudit(db, { actorId: ctx.userId, action: "customer.view", entityType: "user", entityId: id });
  return {
    ...u,
    createdAt: u.createdAt.toISOString(),
    orders: orderRows.map((o) => ({ ...o, createdAt: o.createdAt.toISOString() })),
    addresses: canSeeAddresses ? addressRows.map((a) => ({ id: a.id, fullName: a.fullName, line1: a.line1, line2: a.line2, city: a.city, region: a.region, postalCode: a.postalCode, country: a.country, phone: a.phone })) : null,
    newsletter: sub[0] ? { status: sub[0].status, consentAt: sub[0].consentAt?.toISOString() ?? null } : null,
    messages: messages.map((m) => ({ ...m, createdAt: m.createdAt.toISOString() })),
  };
}

// ---------------------------------------------------------------- messages (contact form)

export const MESSAGE_STATUS = ["new", "open", "closed"] as const;

export async function listMessages(db: Database, actor: AccessContext | null, raw: { status?: string }) {
  authorize(actor, "customers:read");
  const status = z.enum([...MESSAGE_STATUS, "all"]).catch("all").parse(raw.status ?? "all");
  const rows = await db
    .select()
    .from(supportRequests)
    .where(status === "all" ? undefined : eq(supportRequests.status, status))
    .orderBy(desc(supportRequests.createdAt))
    .limit(300);
  const counts = await db.select({ status: supportRequests.status, n: sql<number>`count(*)::int` }).from(supportRequests).groupBy(supportRequests.status);
  return {
    status,
    counts: Object.fromEntries(counts.map((c) => [c.status, c.n])) as Partial<Record<(typeof MESSAGE_STATUS)[number], number>>,
    items: rows.map((r) => ({ id: r.id, name: r.name, email: r.email, topic: r.topic, message: r.message, status: r.status, createdAt: r.createdAt.toISOString() })),
  };
}

export async function setMessageStatus(db: Database, actor: AccessContext | null, id: string, status: string) {
  const ctx = authorize(actor, "customers:read");
  const s = z.enum(MESSAGE_STATUS).parse(status);
  const [row] = await db.update(supportRequests).set({ status: s, updatedAt: new Date() }).where(eq(supportRequests.id, z.uuid().parse(id))).returning({ id: supportRequests.id });
  if (!row) throw new UserError("Message not found.");
  await recordAudit(db, { actorId: ctx.userId, action: "message.status", entityType: "support_request", entityId: id, after: { status: s } });
}

// ---------------------------------------------------------------- newsletter

export async function listSubscribers(db: Database, actor: AccessContext | null) {
  authorize(actor, "marketing:write");
  const rows = await db.select().from(newsletterSubscribers).orderBy(desc(newsletterSubscribers.createdAt)).limit(5000);
  const counts = { pending: 0, confirmed: 0, unsubscribed: 0 };
  for (const r of rows) counts[r.status]++;
  return {
    counts,
    items: rows.map((r) => ({ id: r.id, email: r.email, status: r.status, source: r.consentSource, consentAt: r.consentAt?.toISOString() ?? null, createdAt: r.createdAt.toISOString() })),
  };
}

/** CSV of subscribers (export is audited). Values are escaped against spreadsheet formula injection. */
export async function exportSubscribersCsv(db: Database, actor: AccessContext | null): Promise<string> {
  const ctx = authorize(actor, "marketing:write");
  const { items } = await listSubscribers(db, ctx);
  const cell = (v: string | null) => {
    let s = v ?? "";
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return `"${s.replace(/"/g, '""')}"`;
  };
  await recordAudit(db, { actorId: ctx.userId, action: "newsletter.export", entityType: "newsletter", after: { rows: items.length } });
  return ["email,status,source,consent_at,created_at", ...items.map((i) => [i.email, i.status, i.source, i.consentAt, i.createdAt].map(cell).join(","))].join("\r\n");
}

export async function unsubscribe(db: Database, actor: AccessContext | null, id: string) {
  const ctx = authorize(actor, "marketing:write");
  const [row] = await db
    .update(newsletterSubscribers)
    .set({ status: "unsubscribed", unsubscribedAt: new Date(), updatedAt: new Date() })
    .where(eq(newsletterSubscribers.id, z.uuid().parse(id)))
    .returning({ id: newsletterSubscribers.id });
  if (!row) throw new UserError("Subscriber not found.");
  await recordAudit(db, { actorId: ctx.userId, action: "newsletter.unsubscribe", entityType: "newsletter_subscriber", entityId: id });
}

// ---------------------------------------------------------------- staff users

export async function listStaff(db: Database, actor: AccessContext | null) {
  authorize(actor, "users:manage");
  const rows = await db
    .select({ id: users.id, name: users.name, email: users.email, twoFactorEnabled: users.twoFactorEnabled, role: userRoles.role, grantedAt: userRoles.grantedAt })
    .from(userRoles)
    .innerJoin(users, eq(users.id, userRoles.userId))
    .orderBy(asc(users.email));
  const byUser = new Map<string, { id: string; name: string; email: string; twoFactorEnabled: boolean; roles: RoleKey[] }>();
  for (const r of rows) {
    const u = byUser.get(r.id) ?? { id: r.id, name: r.name, email: r.email, twoFactorEnabled: Boolean(r.twoFactorEnabled), roles: [] };
    u.roles.push(r.role);
    byUser.set(r.id, u);
  }
  return [...byUser.values()];
}

/**
 * Gives a role to an existing account, found by e-mail. The person must have created their
 * account first (sign up on the site); staff then must turn on two-factor before using the admin.
 */
export async function grantRoleByEmail(db: Database, actor: AccessContext | null, raw: unknown) {
  authorize(actor, "users:manage");
  const input = z.object({ email: z.email("Enter a valid e-mail").transform((v) => v.toLowerCase()), role: z.enum(ROLE_KEYS) }).parse(raw);
  const [u] = await db.select({ id: users.id }).from(users).where(sql`lower(${users.email}) = ${input.email}`).limit(1);
  if (!u) throw new UserError("No account with this e-mail. Ask the person to create an account on the site first, then add the role here.", "email");
  await grantRole(db, actor, { targetUserId: u.id, role: input.role });
  return { userId: u.id };
}

export async function revokeStaffRole(db: Database, actor: AccessContext | null, raw: unknown) {
  authorize(actor, "users:manage");
  const input = z.object({ targetUserId: z.uuid(), role: z.enum(ROLE_KEYS) }).parse(raw);
  if (input.role === "super_admin") {
    const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(userRoles).where(eq(userRoles.role, "super_admin"));
    if (n <= 1) throw new UserError("This is the last super admin. Add another super admin before removing this one.");
  }
  try {
    await revokeRole(db, actor, input);
  } catch (e) {
    if (e instanceof Error && e.message.includes("cannot remove their own")) throw new UserError("You cannot remove your own super admin role.");
    throw e;
  }
}

/**
 * Lost phone and no backup codes: a super admin turns off another person's two-factor and
 * signs them out everywhere. They must set it up again before entering the admin.
 */
export async function resetTwoFactor(db: Database, actor: AccessContext | null, targetUserId: string) {
  const ctx = authorize(actor, "users:manage");
  const id = z.uuid().parse(targetUserId);
  if (id === ctx.userId) throw new UserError("You cannot reset your own two-factor here. Use a backup code.");
  await db.transaction(async (tx) => {
    const [u] = await tx.update(users).set({ twoFactorEnabled: false, updatedAt: new Date() }).where(eq(users.id, id)).returning({ id: users.id });
    if (!u) throw new UserError("Person not found.");
    await tx.delete(twoFactors).where(eq(twoFactors.userId, id));
    await tx.delete(sessions).where(eq(sessions.userId, id));
    await recordAudit(tx, { actorId: ctx.userId, action: "user.two_factor_reset", entityType: "user", entityId: id });
  });
}
