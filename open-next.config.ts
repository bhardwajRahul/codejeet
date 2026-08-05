import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import staticAssetsIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache";

// Workers Builds has no Bun; committed bun.lock made OpenNext run `bun run build`.
const config = defineCloudflareConfig({
  incrementalCache: staticAssetsIncrementalCache,
  enableCacheInterception: true,
});

const openNextConfig = {
  ...config,
  buildCommand: "CI=true pnpm run build",
};

export default openNextConfig;
