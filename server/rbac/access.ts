import { eq } from "drizzle-orm";
import type { Database } from "@/db/client";
import { userRoles, users, type RoleKey } from "@/db/schema";
import { ADMIN_SESSION_MAX_AGE_MS, hasPermission, isStaff, type Permission } from "./permissions";

export type AccessContext = {
  userId: string;
  email: string;
  roles: RoleKey[];
  twoFactorEnabled: boolean;
  sessionCreatedAt: Date;
};

export type AccessDenial =
  | "unauthenticated"
  | "not_staff"
  | "mfa_required"
  | "session_too_old"
  | "forbidden";

export type AccessDecision = { ok: true; ctx: AccessContext } | { ok: false; reason: AccessDenial };

/**
 * Pure decision: given who is asking, may they use this admin permission?
 * Order matters: identity, staff role, MFA, session freshness, then the specific permission.
 */
export function decideStaffAccess(
  ctx: AccessContext | null,
  permission: Permission | null,
  now: Date = new Date(),
): AccessDecision {
  if (!ctx) return { ok: false, reason: "unauthenticated" };
  if (!isStaff(ctx.roles)) return { ok: false, reason: "not_staff" };
  if (!ctx.twoFactorEnabled) return { ok: false, reason: "mfa_required" };
  if (now.getTime() - ctx.sessionCreatedAt.getTime() > ADMIN_SESSION_MAX_AGE_MS)
    return { ok: false, reason: "session_too_old" };
  if (permission && !hasPermission(ctx.roles, permission)) return { ok: false, reason: "forbidden" };
  return { ok: true, ctx };
}

/** Loads the user's current roles and MFA state from the database (never from the client). */
export async function loadAccessContext(
  db: Database,
  session: { userId: string; createdAt: Date },
): Promise<AccessContext | null> {
  const [user] = await db
    .select({ id: users.id, email: users.email, twoFactorEnabled: users.twoFactorEnabled })
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);
  if (!user) return null;
  const roleRows = await db
    .select({ role: userRoles.role })
    .from(userRoles)
    .where(eq(userRoles.userId, user.id));
  return {
    userId: user.id,
    email: user.email,
    roles: roleRows.map((r) => r.role),
    twoFactorEnabled: Boolean(user.twoFactorEnabled),
    sessionCreatedAt: session.createdAt,
  };
}

export class AccessDeniedError extends Error {
  constructor(public readonly reason: AccessDenial) {
    super(`Access denied: ${reason}`);
    this.name = "AccessDeniedError";
  }
}
