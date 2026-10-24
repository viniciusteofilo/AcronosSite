import { eq } from "drizzle-orm";
import type { Database } from "@/db/client";
import { userRoles } from "@/db/schema";
import { isTestEnvironment } from "@/lib/site-url";
import { recordAudit } from "@/server/audit/log";

/**
 * TEST ENVIRONMENT ONLY: the account created with BOOTSTRAP_ADMIN_EMAIL becomes the first
 * super admin, so the owner can start testing without a command line. Does nothing in
 * production (there the "First super admin" workflow is used) or once a super admin exists.
 */
export async function bootstrapTestAdmin(db: Database, user: { id: string; email: string }) {
  const wanted = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
  if (!isTestEnvironment() || !wanted || user.email.toLowerCase() !== wanted) return;
  const [existing] = await db.select({ id: userRoles.userId }).from(userRoles).where(eq(userRoles.role, "super_admin")).limit(1);
  if (existing) return;
  await db.insert(userRoles).values({ userId: user.id, role: "super_admin" });
  await recordAudit(db, { actorId: null, action: "role.bootstrap_test_admin", entityType: "user", entityId: user.id, after: { role: "super_admin" } });
}
