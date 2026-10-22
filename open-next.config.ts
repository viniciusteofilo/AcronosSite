import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";

// Prerendered pages are kept in the R2 bucket bound as NEXT_INC_CACHE_R2_BUCKET.
export default defineCloudflareConfig({
  incrementalCache: r2IncrementalCache,
});
