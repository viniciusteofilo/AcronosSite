// Temporary patch for @opennextjs/cloudflare 1.20.9 (pinned: newer releases are under two weeks old).
// Next.js 16.4 added `.next/server/preview-props.json`; 1.20.13 inlines it. This applies the same
// one-line change. Remove this script when upgrading to 1.20.13 or later (after 2026-11-04).
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const file = "node_modules/@opennextjs/cloudflare/dist/cli/build/patches/plugins/load-manifest.js";
if (!existsSync(file)) process.exit(0);
const src = readFileSync(file, "utf8");
if (src.includes("server/preview-props.json")) process.exit(0);
const from = 'const manifests = await glob(join(dotNextDir, "**/{*-manifest,required-server-files,prefetch-hints}.json"), {';
const to = 'const manifests = await glob([join(dotNextDir, "**/{*-manifest,required-server-files,prefetch-hints}.json"), join(dotNextDir, "server/preview-props.json")], { nodir: true,';
if (!src.includes(from)) {
  console.error("[patch-opennext] expected code not found; check the installed version");
  process.exit(1);
}
writeFileSync(file, src.replace(from, to));
console.log("[patch-opennext] applied preview-props.json fix");
