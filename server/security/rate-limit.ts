import { sql } from "drizzle-orm";
import type { Database } from "@/db/client";
import { rateLimits } from "@/db/schema";

/**
 * Fixed-window limiter on the shared rate_limits table (the same store Better Auth uses),
 * so limits hold across server instances. One atomic UPSERT per call.
 * Returns true when the action is allowed.
 */
export async function takeRateLimit(
  db: Database,
  key: string,
  max: number,
  windowSeconds: number,
  now: number = Date.now(),
): Promise<boolean> {
  const windowStart = now - windowSeconds * 1000;
  const [row] = await db
    .insert(rateLimits)
    .values({ key: `app:${key}`, count: 1, lastRequest: now })
    .onConflictDoUpdate({
      target: rateLimits.key,
      set: {
        count: sql`CASE WHEN ${rateLimits.lastRequest} < ${windowStart} THEN 1 ELSE ${rateLimits.count} + 1 END`,
        lastRequest: sql`CASE WHEN ${rateLimits.lastRequest} < ${windowStart} THEN ${now} ELSE ${rateLimits.lastRequest} END`,
      },
    })
    .returning({ count: rateLimits.count });
  return (row?.count ?? 1) <= max;
}
