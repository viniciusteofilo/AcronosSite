import { config } from "dotenv";
import { sql } from "drizzle-orm";
import { createDb } from "@/db/client";
import { merchantEntities, orders, userRoles, users, type RoleKey } from "@/db/schema";
import type { AccessContext } from "@/server/rbac/access";

config({ path: [".env.local", ".env"] });

export function testDb() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error("TEST_DATABASE_URL is not set");
  process.env.BETTER_AUTH_SECRET ??= "test-secret-test-secret-test-secret-123";
  process.env.BETTER_AUTH_URL ??= "http://localhost:3000";
  return createDb(url);
}

let counter = 0;
const unique = () => `${Date.now()}-${++counter}`;

export async function makeUser(
  db: ReturnType<typeof testDb>["db"],
  opts: { roles?: RoleKey[]; twoFactorEnabled?: boolean } = {},
) {
  const [user] = await db
    .insert(users)
    .values({
      name: "Test User",
      email: `user-${unique()}@example.test`,
      twoFactorEnabled: opts.twoFactorEnabled ?? false,
    })
    .returning();
  for (const role of opts.roles ?? []) await db.insert(userRoles).values({ userId: user.id, role });
  return user;
}

export function ctxFor(
  user: { id: string; email: string },
  roles: RoleKey[],
  opts: { twoFactorEnabled?: boolean; sessionCreatedAt?: Date } = {},
): AccessContext {
  return {
    userId: user.id,
    email: user.email,
    roles,
    twoFactorEnabled: opts.twoFactorEnabled ?? true,
    sessionCreatedAt: opts.sessionCreatedAt ?? new Date(),
  };
}

export async function makeMerchant(db: ReturnType<typeof testDb>["db"]) {
  const [m] = await db
    .insert(merchantEntities)
    .values({ legalName: "Test Merchant", country: "BR", settlementCurrency: "BRL", isActive: true })
    .returning();
  return m;
}

export async function makeOrder(
  db: ReturnType<typeof testDb>["db"],
  opts: { userId: string | null; merchantId: string; totalMinor?: number },
) {
  const total = opts.totalMinor ?? 10_000;
  const [o] = await db
    .insert(orders)
    .values({
      number: `ACN-${unique()}`,
      userId: opts.userId,
      email: "buyer@example.test",
      merchantEntityId: opts.merchantId,
      currency: "USD",
      subtotalMinor: total,
      totalMinor: total,
      idempotencyKey: `idem-${unique()}`,
    })
    .returning();
  return o;
}

/** Returns the Postgres error code thrown by a query (e.g. 23514 check violation). */
export async function pgErrorCode(fn: () => Promise<unknown>): Promise<string | undefined> {
  try {
    await fn();
    return undefined;
  } catch (e) {
    let err: unknown = e;
    while (err && typeof err === "object") {
      if ("code" in err && typeof err.code === "string") return err.code;
      err = "cause" in err ? err.cause : undefined;
    }
    return "unknown";
  }
}

export { sql };
