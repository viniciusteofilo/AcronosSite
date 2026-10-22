import { timingSafeEqual } from "node:crypto";
import { getDb } from "@/db/client";
import { cloudflare } from "@/lib/cloudflare";
import { runMaintenance } from "@/server/maintenance";

/**
 * Called by the Worker's cron trigger (custom-worker.ts) with a shared secret.
 * Anyone else gets 404, so the endpoint does not reveal itself.
 */
export async function POST(request: Request) {
  const secret = cloudflare()?.env.CRON_SECRET ?? process.env.CRON_SECRET ?? "";
  const given = request.headers.get("x-cron-secret") ?? "";
  const ok = secret.length >= 32 && given.length === secret.length && timingSafeEqual(Buffer.from(given), Buffer.from(secret));
  if (!ok) return new Response("Not found", { status: 404 });
  const result = await runMaintenance(getDb());
  return Response.json(result);
}
