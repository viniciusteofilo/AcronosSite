import { and, eq, ne } from "drizzle-orm";
import type { Database } from "@/db/client";
import { sessions, userRoles, users } from "@/db/schema";
import { describeAgent } from "@/server/account/self-service";
import { sendEmail } from "@/server/email/send";
import { staffSignInMessage } from "@/server/email/templates";

type NewSession = { id: string; userId: string; userAgent?: string | null; ipAddress?: string | null; createdAt: Date };

/**
 * Staff accounts get an e-mail when they sign in from a browser they had no session on.
 * A stolen password then shows up in the owner's inbox. Customers are not e-mailed.
 */
export async function alertStaffSignIn(db: Database, s: NewSession) {
  try {
    const roles = await db.select({ role: userRoles.role }).from(userRoles).where(eq(userRoles.userId, s.userId)).limit(1);
    if (!roles.length) return;
    const ua = s.userAgent ?? "";
    const known = await db
      .select({ id: sessions.id })
      .from(sessions)
      .where(and(eq(sessions.userId, s.userId), eq(sessions.userAgent, ua), ne(sessions.id, s.id)))
      .limit(1);
    if (known.length) return;
    const [u] = await db.select({ name: users.name, email: users.email }).from(users).where(eq(users.id, s.userId)).limit(1);
    if (!u) return;
    await sendEmail(db, { kind: "staff_sign_in", to: u.email, ref: s.userId, ...staffSignInMessage(u.name, describeAgent(ua || null), s.ipAddress ?? null, new Date(s.createdAt)) });
  } catch (e) {
    console.error("[auth] sign-in alert failed", e);
  }
}
