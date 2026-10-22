import { and, lt, sql } from "drizzle-orm";
import type { Database } from "@/db/client";
import { carts, rateLimits, sessions, verifications } from "@/db/schema";
import { releaseExpiredReservations } from "@/server/orders/checkout";

/**
 * Housekeeping run every 10 minutes by the Cloudflare cron trigger:
 * frees stock held by abandoned checkouts and removes expired technical records.
 */
export async function runMaintenance(db: Database, now: Date = new Date()) {
  const released = await releaseExpiredReservations(db, now);
  const day = 86_400_000;
  const [s, v, r, c] = await Promise.all([
    db.delete(sessions).where(lt(sessions.expiresAt, now)).returning({ id: sessions.id }),
    db.delete(verifications).where(lt(verifications.expiresAt, now)).returning({ id: verifications.id }),
    db.delete(rateLimits).where(lt(rateLimits.lastRequest, now.getTime() - day)).returning({ id: rateLimits.id }),
    // carts nobody touched for 60 days (their items were never reserved)
    db.delete(carts).where(and(lt(carts.updatedAt, new Date(now.getTime() - 60 * day)), sql`true`)).returning({ id: carts.id }),
  ]);
  return { releasedCheckouts: released, sessions: s.length, verifications: v.length, rateLimits: r.length, carts: c.length };
}
