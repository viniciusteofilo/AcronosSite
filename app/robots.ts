import type { MetadataRoute } from "next";
import { isTestEnvironment, siteUrl } from "@/lib/site-url";

export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();
  if (isTestEnvironment()) return { rules: [{ userAgent: "*", disallow: "/" }] };
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/account", "/login", "/cart", "/api/"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
