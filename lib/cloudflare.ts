/**
 * Access to Cloudflare bindings when the site runs on Workers (OpenNext sets this per request).
 * Returns undefined in Node (local development, tests), where the classic setup is used.
 */
type R2Object = { arrayBuffer(): Promise<ArrayBuffer>; httpMetadata?: { contentType?: string } };
export type CloudflareBindings = {
  HYPERDRIVE?: { connectionString: string };
  MEDIA_BUCKET?: {
    put(key: string, value: Uint8Array, options?: { httpMetadata?: { contentType?: string; cacheControl?: string } }): Promise<unknown>;
    get(key: string): Promise<R2Object | null>;
    delete(key: string): Promise<void>;
  };
  CRON_SECRET?: string;
};

export function cloudflare(): { env: CloudflareBindings; ctx: object } | undefined {
  try {
    return (globalThis as Record<symbol, { env: CloudflareBindings; ctx: object } | undefined>)[Symbol.for("__cloudflare-context__")];
  } catch {
    return undefined;
  }
}
