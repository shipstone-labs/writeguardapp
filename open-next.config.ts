import { defineCloudflareConfig } from "@opennextjs/cloudflare";
// Uncomment when ready to use R2 for caching
import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";

export default defineCloudflareConfig({
  // For now, use default cache. When R2 is set up, uncomment:
  incrementalCache: r2IncrementalCache,
});
