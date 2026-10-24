import { config } from "dotenv";
import { createInterface } from "node:readline/promises";
import { eq } from "drizzle-orm";
import { z } from "zod";

config({ path: [".env.local", ".env"] });

/**
 * Bootstrap the FIRST super admin from the command line (no credentials in code).
 *   npm run admin:create -- --email you@company.com --name "Your Name"
 * The password is typed at the prompt. Refuses to run if a super admin already exists;
 * after that, roles are granted from the admin panel by a super admin (audited).
 */
async function main() {
  const { createDb } = await import("../db/client");
  const { userRoles } = await import("../db/schema");
  const { createAuth } = await import("../server/auth/auth");
  const { recordAudit } = await import("../server/audit/log");

  const args = process.argv.slice(2);
  const arg = (name: string) => {
    const i = args.indexOf(`--${name}`);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const input = z
    .object({ email: z.email(), name: z.string().min(2) })
    .parse({ email: arg("email"), name: arg("name") });

  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const { db, client } = createDb(url);
  try {
    const existing = await db
      .select({ userId: userRoles.userId })
      .from(userRoles)
      .where(eq(userRoles.role, "super_admin"))
      .limit(1);
    if (existing.length > 0) {
      throw new Error("A super admin already exists. Grant further roles from the admin panel.");
    }

    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const password = await rl.question("Password (min. 12 characters): ");
    rl.close();

    const auth = createAuth(db);
    const result = await auth.api.signUpEmail({
      body: { email: input.email, name: input.name, password },
    });
    const userId = result.user.id;

    await db.transaction(async (tx) => {
      await tx.insert(userRoles).values({ userId, role: "super_admin" });
      await recordAudit(tx, {
        actorId: null,
        action: "role.bootstrap_super_admin",
        entityType: "user",
        entityId: userId,
        after: { role: "super_admin", via: "cli" },
      });
    });
    console.log(
      `Super admin created for ${input.email}. Sign in at /login and enable two-factor authentication before opening /admin.`,
    );
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
