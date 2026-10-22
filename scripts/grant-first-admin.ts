import { eq, sql } from "drizzle-orm";
import { z } from "zod";

/**
 * Makes an EXISTING account the first super admin (used once, right after launch).
 *   DATABASE_URL=... npx tsx scripts/grant-first-admin.ts person@example.com
 * The person first creates their account on the live site. Refuses if a super admin exists.
 */
async function main() {
  const { createDb } = await import("../db/client");
  const { userRoles, users } = await import("../db/schema");
  const { recordAudit } = await import("../server/audit/log");
  const email = z.email().parse(process.argv[2]).toLowerCase();
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const { db, client } = createDb(url);
  try {
    const [existing] = await db.select({ id: userRoles.userId }).from(userRoles).where(eq(userRoles.role, "super_admin")).limit(1);
    if (existing) throw new Error("A super admin already exists. Grant roles from Admin → Users.");
    const [user] = await db.select({ id: users.id }).from(users).where(sql`lower(${users.email}) = ${email}`).limit(1);
    if (!user) throw new Error("No account with this e-mail. Create the account on the site first.");
    await db.transaction(async (tx) => {
      await tx.insert(userRoles).values({ userId: user.id, role: "super_admin" });
      await recordAudit(tx, { actorId: null, action: "role.grant_first_super_admin", entityType: "user", entityId: user.id, after: { role: "super_admin" } });
    });
    console.log("Done. Sign in, turn on two-factor at /account/security, then open /admin.");
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
