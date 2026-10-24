// Build command on Vercel: apply database migrations first (direct, non-pooled connection),
// then build Next.js. Fails the deploy if a migration fails, so the old version keeps running.
import { execSync } from "node:child_process";

const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is missing: connect the Neon database in Vercel → Storage.");
  process.exit(1);
}
execSync("npx tsx db/migrate.ts", { stdio: "inherit", env: { ...process.env, DATABASE_URL: url } });
execSync("npx next build", { stdio: "inherit" });
