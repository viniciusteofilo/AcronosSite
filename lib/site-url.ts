/**
 * Public address of the site. SITE_URL is read at runtime (Cloudflare var); the NEXT_PUBLIC_
 * value is a build-time fallback. Moving to the new domain = change both and redeploy.
 */
export function siteUrl(): string {
  return (process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
}
