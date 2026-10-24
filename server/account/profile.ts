import { and, asc, count, eq } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "@/db/client";
import { addresses, users } from "@/db/schema";
import { UserError } from "@/server/admin/errors";
import { addressSchema } from "@/server/orders/checkout";
import { AccessDeniedError, type AccessContext } from "@/server/rbac/access";

/** Every function here works only on the signed-in person's own data (id from the session). */
function me(actor: AccessContext | null) {
  if (!actor) throw new AccessDeniedError("unauthenticated");
  return actor;
}

export const MAX_ADDRESSES = 10;

export async function getProfile(db: Database, actor: AccessContext | null) {
  const ctx = me(actor);
  const [u] = await db.select({ name: users.name, email: users.email, emailVerified: users.emailVerified }).from(users).where(eq(users.id, ctx.userId)).limit(1);
  if (!u) throw new AccessDeniedError("unauthenticated");
  return u;
}

export async function updateName(db: Database, actor: AccessContext | null, raw: unknown) {
  const ctx = me(actor);
  const name = z.string().trim().min(2, "Enter your name.").max(120).parse(raw);
  await db.update(users).set({ name, updatedAt: new Date() }).where(eq(users.id, ctx.userId));
}

export type SavedAddress = z.infer<typeof addressSchema> & { id: string };

export async function listAddresses(db: Database, actor: AccessContext | null): Promise<SavedAddress[]> {
  const ctx = me(actor);
  const rows = await db.select().from(addresses).where(eq(addresses.userId, ctx.userId)).orderBy(asc(addresses.createdAt));
  return rows.map((r) => ({ id: r.id, fullName: r.fullName, line1: r.line1, line2: r.line2 ?? "", city: r.city, region: r.region ?? "", postalCode: r.postalCode, country: r.country, phone: r.phone ?? "" }));
}

const saveInput = addressSchema.extend({ id: z.uuid().optional() });

export async function saveAddress(db: Database, actor: AccessContext | null, raw: unknown) {
  const ctx = me(actor);
  const { id, ...a } = saveInput.parse(raw);
  const values = { ...a, line2: a.line2 || null, region: a.region || null, phone: a.phone || null, updatedAt: new Date() };
  if (id) {
    const [row] = await db.update(addresses).set(values).where(and(eq(addresses.id, id), eq(addresses.userId, ctx.userId))).returning({ id: addresses.id });
    if (!row) throw new UserError("Address not found.");
    return row.id;
  }
  const [{ n }] = await db.select({ n: count() }).from(addresses).where(eq(addresses.userId, ctx.userId));
  if (n >= MAX_ADDRESSES) throw new UserError(`You can keep up to ${MAX_ADDRESSES} addresses. Remove one first.`);
  const [row] = await db.insert(addresses).values({ ...values, userId: ctx.userId }).returning({ id: addresses.id });
  return row.id;
}

export async function deleteAddress(db: Database, actor: AccessContext | null, id: string) {
  const ctx = me(actor);
  if (!z.uuid().safeParse(id).success) throw new UserError("Address not found.");
  const [row] = await db.delete(addresses).where(and(eq(addresses.id, id), eq(addresses.userId, ctx.userId))).returning({ id: addresses.id });
  if (!row) throw new UserError("Address not found.");
}

/** After a checkout: keep the address for next time unless the same one is already saved. */
export async function rememberAddress(db: Database, actor: AccessContext | null, raw: unknown) {
  const ctx = me(actor);
  const parsed = addressSchema.safeParse(raw);
  if (!parsed.success) return;
  const a = parsed.data;
  const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();
  const existing = await listAddresses(db, ctx);
  if (existing.some((e) => norm(e.line1) === norm(a.line1) && norm(e.postalCode) === norm(a.postalCode) && e.country === a.country && norm(e.fullName) === norm(a.fullName))) return;
  if (existing.length >= MAX_ADDRESSES) return;
  await saveAddress(db, ctx, a);
}
