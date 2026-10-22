// Cloudflare Worker entry: the Next.js app (built by OpenNext) plus a cron trigger.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- generated at build time; file excluded from tsc
// @ts-ignore
import { default as handler } from "./.open-next/worker.js";

type Env = { CRON_SECRET?: string; SITE_URL?: string };

const worker = {
  fetch: handler.fetch,

  /** Every 10 minutes: release stock held by abandoned checkouts and clean expired records. */
  async scheduled(_event: unknown, env: Env, ctx: { waitUntil(p: Promise<unknown>): void }) {
    if (!env.CRON_SECRET) return;
    const url = new URL("/api/cron/maintenance", env.SITE_URL ?? "https://localhost");
    const request = new Request(url, { method: "POST", headers: { "x-cron-secret": env.CRON_SECRET } });
    ctx.waitUntil(
      handler.fetch(request, env, ctx).then(async (r: Response) => {
        if (!r.ok) console.error("[cron] maintenance failed", r.status, await r.text());
      }),
    );
  },
};

export default worker;

// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- generated at build time; file excluded from tsc
// @ts-ignore
export { DOQueueHandler, DOShardedTagCache, BucketCachePurge } from "./.open-next/worker.js";
