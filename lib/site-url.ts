/**
 * Public address of the site. SITE_URL is read at runtime (Cloudflare var); the NEXT_PUBLIC_
 * value is a build-time fallback. Moving to the new domain = change both and redeploy.
 */
export function siteUrl(): string {
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL; // set automatically on Vercel
  return (process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || (vercel ? `https://${vercel}` : "") || "http://localhost:3000").replace(/\/$/, "");
}

/** "test" on the private test environment: shows a banner and hides the site from search engines. */
export function isTestEnvironment(): boolean {
  return process.env.APP_ENV === "test" || process.env.NEXT_PUBLIC_APP_ENV === "test";
}
