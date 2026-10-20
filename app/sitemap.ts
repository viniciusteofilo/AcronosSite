import type { MetadataRoute } from "next";
import { and, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { collections, products, stories } from "@/db/schema";

/** Lists every public page and every published product, collection and story. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const fixed = ["", "/shop", "/collections", "/about", "/lab", "/sci-fi", "/contact"].map((p) => ({ url: `${base}${p}` }));
  try {
    const db = getDb();
    const now = new Date();
    const [prods, cols, sts] = await Promise.all([
      db.select({ slug: products.slug, updatedAt: products.updatedAt }).from(products)
        .where(and(eq(products.status, "published"), sql`(${products.publishedAt} IS NULL OR ${products.publishedAt} <= ${now.toISOString()})`)),
      db.select({ slug: collections.slug, updatedAt: collections.updatedAt }).from(collections).where(eq(collections.status, "published")),
      db.select({ slug: stories.slug, updatedAt: stories.updatedAt }).from(stories)
        .where(and(inArray(stories.status, ["published", "scheduled"]), sql`coalesce(${stories.publishAt}, ${stories.publishedAt}, ${stories.createdAt}) <= ${now.toISOString()}`)),
    ]);
    return [
      ...fixed,
      ...prods.map((p) => ({ url: `${base}/products/${p.slug}`, lastModified: p.updatedAt })),
      ...cols.map((c) => ({ url: `${base}/collections/${c.slug}`, lastModified: c.updatedAt })),
      ...sts.map((s) => ({ url: `${base}/sci-fi/${s.slug}`, lastModified: s.updatedAt })),
    ];
  } catch {
    return fixed; // database unavailable at build time: the dynamic entries are added at runtime
  }
}
