import { and, eq } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "@/db/client";
import { ROLE_KEYS, userRoles, users } from "@/db/schema";
import { recordAudit } from "@/server/audit/log";
import { AccessDeniedError, decideStaffAccess, type AccessContext } from "./access";

const grantInput = z.object({
  targetUserId: z.uuid(),
  role: z.enum(ROLE_KEYS),
});

/**
 * Grants a staff role. Requires users:manage, validates input on the server and writes
 * the change and its audit record in one transaction.
 */
export async function grantRole(
  db: Database,
  actor: AccessContext | null,
  input: unknown,
  meta: { ipAddress?: string | null } = {},
): Promise<void> {
  const decision = decideStaffAccess(actor, "users:manage");
  if (!decision.ok) throw new AccessDeniedError(decision.reason);
  const { targetUserId, role } = grantInput.parse(input);

  await db.transaction(async (tx) => {
    const [target] = await tx.select({ id: users.id }).from(users).where(eq(users.id, targetUserId));
    if (!target) throw new Error("Target user not found");
    await tx
      .insert(userRoles)
      .values({ userId: targetUserId, role, grantedBy: decision.ctx.userId })
      .onConflictDoNothing();
    await recordAudit(tx, {
      actorId: decision.ctx.userId,
      action: "role.grant",
      entityType: "user",
      entityId: targetUserId,
      after: { role },
      ipAddress: meta.ipAddress,
    });
  });
}

export async function revokeRole(
  db: Database,
  actor: AccessContext | null,
  input: unknown,
  meta: { ipAddress?: string | null } = {},
): Promise<void> {
  const decision = decideStaffAccess(actor, "users:manage");
  if (!decision.ok) throw new AccessDeniedError(decision.reason);
  const { targetUserId, role } = grantInput.parse(input);
  if (targetUserId === decision.ctx.userId && role === "super_admin") {
    throw new Error("A super admin cannot remove their own super admin role");
  }
  await db.transaction(async (tx) => {
    await tx
      .delete(userRoles)
      .where(and(eq(userRoles.userId, targetUserId), eq(userRoles.role, role)));
    await recordAudit(tx, {
      actorId: decision.ctx.userId,
      action: "role.revoke",
      entityType: "user",
      entityId: targetUserId,
      before: { role },
      ipAddress: meta.ipAddress,
    });
  });
}
