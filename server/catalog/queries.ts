import { and, asc, desc, eq, inArray, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "@/db/client";
import {
  categories,
  collections,
  inventoryLevels,
  mediaAssets,
  productCollections,
  productImages,
  products,
  productVariants,
  variantPrices,
} from "@/db/schema";
import { getMediaByIds, toMediaView, type MediaView } from "@/server/media/library";

/** Storefront prices are shown in USD (the checkout converts for other countries). */
export const STORE_CURRENCY = "USD";

/** A product is visible only when published, its publish time has passed and it has a sellable variant. */
const isVisible = (now: Date) =>
  and(eq(products.status, "published"), sql`(${products.publishedAt} IS NULL OR ${products.publishedAt} <= ${now.toISOString()})`);

export const shopFilterSchema = z.object({
  q: z.string().trim().max(80).optional(),
  category: z.string().trim().max(80).optional(),
  collection: z.string().trim().max(80).optional(),
  size: z.array(z.string().trim().max(20)).max(12).default([]),
  color: z.array(z.string().trim().max(40)).max(12).default([]),
  min: z.coerce.number().int().min(0).max(100_000).optional(),
  max: z.coerce.number().int().min(0).max(100_000).optional(),
  inStock: z.boolean().default(false),
  sort: z.enum(["newest", "price_asc", "price_desc"]).default("newest"),
  page: z.coerce.number().int().min(1).max(500).default(1),
});

export type ShopFilters = z.infer<typeof shopFilterSchema>;

/** Turns URL query parameters into validated filters. Unknown or invalid values are dropped. */
export function parseShopFilters(params: Record<string, string | string[] | undefined>): ShopFilters {
  const list = (v: string | string[] | undefined) => (Array.isArray(v) ? v : v ? v.split(",") : []).filter(Boolean);
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;
  const raw = {
    q: one(params.q),
    category: one(params.category),
    collection: one(params.collection),
    size: list(params.size),
    color: list(params.color),
    min: one(params.min),
    max: one(params.max),
    inStock: one(params.stock) === "1",
    sort: one(params.sort),
    page: one(params.page),
  };
  const parsed = shopFilterSchema.safeParse(raw);
  if (parsed.success) return parsed.data;
  return shopFilterSchema.parse({});
}

export type ProductListItem = {
  id: string;
  slug: string;
  name: string;
  code: string;
  priceMinor: number;
  compareAtMinor: number | null;
  currency: string;
  available: number;
  colors: string[];
  image: MediaView | null;
  isNew: boolean;
};

export const PAGE_SIZE = 24;

/** Shop listing with filters, sorting and pagination, computed in one SQL query. */
export async function listProducts(
  db: Database,
  filters: ShopFilters,
  opts: { now?: Date; limit?: number; ids?: string[] } = {},
): Promise<{ items: ProductListItem[]; total: number; page: number; pages: number }> {
  const now = opts.now ?? new Date();
  const limit = opts.limit ?? PAGE_SIZE;
  const variantConds: SQL[] = [eq(productVariants.isActive, true)];
  if (filters.size.length) variantConds.push(inArray(productVariants.size, filters.size));
  if (filters.color.length) variantConds.push(inArray(productVariants.color, filters.color));

  const where: (SQL | undefined)[] = [isVisible(now)];
  if (opts.ids) where.push(opts.ids.length ? inArray(products.id, opts.ids) : sql`false`);
  if (filters.q) {
    const term = `%${filters.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    where.push(sql`(${products.name} ILIKE ${term} OR ${products.description} ILIKE ${term})`);
  }
  if (filters.category) where.push(eq(categories.slug, filters.category));
  if (filters.collection) {
    where.push(
      sql`EXISTS (SELECT 1 FROM ${productCollections} pc JOIN ${collections} c ON c.id = pc.collection_id
           WHERE pc.product_id = "products"."id" AND c.slug = ${filters.collection} AND c.status = 'published')`,
    );
  }

  const price = sql<number>`min(${variantPrices.amountMinor})`;
  const available = sql<number>`coalesce(sum(greatest(${inventoryLevels.onHand} - ${inventoryLevels.reserved}, 0)), 0)`;
  const having: SQL[] = [];
  if (filters.min !== undefined) having.push(sql`${price} >= ${filters.min * 100}`);
  if (filters.max !== undefined) having.push(sql`${price} <= ${filters.max * 100}`);
  if (filters.inStock) having.push(sql`${available} > 0`);

  const order =
    filters.sort === "price_asc"
      ? [asc(price), asc(products.name)]
      : filters.sort === "price_desc"
        ? [desc(price), asc(products.name)]
        : [desc(sql`coalesce(${products.publishedAt}, ${products.createdAt})`), asc(products.name)];

  const rows = await db
    .select({
      id: products.id,
      slug: products.slug,
      name: products.name,
      code: sql<string>`min(${productVariants.sku})`,
      priceMinor: price,
      compareAtMinor: sql<number | null>`max(${variantPrices.compareAtMinor})`,
      available,
      colors: sql<string[]>`coalesce(array_agg(DISTINCT ${productVariants.colorHex}) FILTER (WHERE ${productVariants.colorHex} IS NOT NULL), '{}')`,
      publishedAt: products.publishedAt,
      imageId: sql<string | null>`(SELECT pi.media_asset_id FROM ${productImages} pi WHERE pi.product_id = "products"."id" ORDER BY pi.sort_order LIMIT 1)`,
      total: sql<number>`count(*) OVER ()`,
    })
    .from(products)
    .innerJoin(productVariants, and(eq(productVariants.productId, products.id), ...variantConds))
    .innerJoin(
      variantPrices,
      and(eq(variantPrices.variantId, productVariants.id), eq(variantPrices.currency, STORE_CURRENCY)),
    )
    .leftJoin(inventoryLevels, eq(inventoryLevels.variantId, productVariants.id))
    .leftJoin(categories, eq(categories.id, products.categoryId))
    .where(and(...where))
    .groupBy(products.id)
    .having(having.length ? and(...having) : undefined)
    .orderBy(...order)
    .limit(limit)
    .offset((filters.page - 1) * limit);

  const media = await getMediaByIds(db, rows.map((r) => r.imageId).filter((v): v is string => Boolean(v)));
  const total = Number(rows[0]?.total ?? 0);
  const thirtyDays = 30 * 24 * 60 * 60 * 1000;
  return {
    items: rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      name: r.name,
      code: r.code,
      priceMinor: Number(r.priceMinor),
      compareAtMinor: r.compareAtMinor === null ? null : Number(r.compareAtMinor),
      currency: STORE_CURRENCY,
      available: Number(r.available),
      colors: r.colors ?? [],
      image: r.imageId ? (media.get(r.imageId) ?? null) : null,
      isNew: r.publishedAt ? now.getTime() - new Date(r.publishedAt).getTime() < thirtyDays : false,
    })),
    total,
    page: filters.page,
    pages: Math.max(1, Math.ceil(total / limit)),
  };
}

/** Values offered in the shop filters: only what published products actually have. */
export async function getShopFacets(db: Database, now: Date = new Date()) {
  const visible = isVisible(now);
  const [cats, sizes, colors] = await Promise.all([
    db
      .selectDistinct({ slug: categories.slug, name: categories.name, sortOrder: categories.sortOrder })
      .from(categories)
      .innerJoin(products, eq(products.categoryId, categories.id))
      .where(visible)
      .orderBy(asc(categories.sortOrder), asc(categories.name)),
    db
      .selectDistinct({ value: productVariants.size })
      .from(productVariants)
      .innerJoin(products, eq(products.id, productVariants.productId))
      .where(and(visible, eq(productVariants.isActive, true), sql`${productVariants.size} IS NOT NULL`)),
    db
      .selectDistinct({ value: productVariants.color, hex: productVariants.colorHex })
      .from(productVariants)
      .innerJoin(products, eq(products.id, productVariants.productId))
      .where(and(visible, eq(productVariants.isActive, true), sql`${productVariants.color} IS NOT NULL`)),
  ]);
  const sizeOrder = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "XXXL"];
  return {
    categories: cats.map(({ slug, name }) => ({ slug, name })),
    sizes: sizes
      .map((s) => s.value!)
      .sort((a, b) => (sizeOrder.indexOf(a) + 1 || 99) - (sizeOrder.indexOf(b) + 1 || 99) || a.localeCompare(b)),
    colors: colors.map((c) => ({ value: c.value!, hex: c.hex })),
  };
}

export type ProductDetail = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  composition: string | null;
  care: string | null;
  technicalInfo: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  category: { slug: string; name: string } | null;
  collections: { slug: string; name: string }[];
  images: MediaView[];
  variants: {
    id: string;
    sku: string;
    size: string | null;
    color: string | null;
    colorHex: string | null;
    priceMinor: number;
    compareAtMinor: number | null;
    available: number;
  }[];
};

export async function getProductBySlug(db: Database, slug: string, now: Date = new Date()): Promise<ProductDetail | null> {
  const [p] = await db
    .select({ product: products, category: { slug: categories.slug, name: categories.name } })
    .from(products)
    .leftJoin(categories, eq(categories.id, products.categoryId))
    .where(and(eq(products.slug, slug), isVisible(now)))
    .limit(1);
  if (!p) return null;
  const [variants, images, cols] = await Promise.all([
    db
      .select({
        id: productVariants.id,
        sku: productVariants.sku,
        size: productVariants.size,
        color: productVariants.color,
        colorHex: productVariants.colorHex,
        priceMinor: variantPrices.amountMinor,
        compareAtMinor: variantPrices.compareAtMinor,
        available: sql<number>`greatest(coalesce(${inventoryLevels.onHand}, 0) - coalesce(${inventoryLevels.reserved}, 0), 0)`,
      })
      .from(productVariants)
      .innerJoin(
        variantPrices,
        and(eq(variantPrices.variantId, productVariants.id), eq(variantPrices.currency, STORE_CURRENCY)),
      )
      .leftJoin(inventoryLevels, eq(inventoryLevels.variantId, productVariants.id))
      .where(and(eq(productVariants.productId, p.product.id), eq(productVariants.isActive, true)))
      .orderBy(asc(productVariants.sku)),
    db
      .select({ media: mediaAssets })
      .from(productImages)
      .innerJoin(mediaAssets, eq(mediaAssets.id, productImages.mediaAssetId))
      .where(eq(productImages.productId, p.product.id))
      .orderBy(asc(productImages.sortOrder)),
    db
      .select({ slug: collections.slug, name: collections.name })
      .from(productCollections)
      .innerJoin(collections, eq(collections.id, productCollections.collectionId))
      .where(and(eq(productCollections.productId, p.product.id), eq(collections.status, "published"))),
  ]);
  if (variants.length === 0) return null; // nothing sellable: not shown
  return {
    id: p.product.id,
    slug: p.product.slug,
    name: p.product.name,
    description: p.product.description,
    composition: p.product.composition,
    care: p.product.care,
    technicalInfo: p.product.technicalInfo,
    seoTitle: p.product.seoTitle,
    seoDescription: p.product.seoDescription,
    category: p.category?.slug ? p.category : null,
    collections: cols,
    images: images.map((i) => toMediaView(i.media)),
    variants: variants.map((v) => ({ ...v, available: Number(v.available) })),
  };
}

export type CollectionCard = {
  slug: string;
  name: string;
  description: string | null;
  image: MediaView | null;
  productCount: number;
};

export async function listCollections(db: Database, now: Date = new Date()): Promise<CollectionCard[]> {
  const rows = await db
    .select({
      slug: collections.slug,
      name: collections.name,
      description: collections.description,
      heroImageId: collections.heroImageId,
      productCount: sql<number>`(SELECT count(*) FROM ${productCollections} pc JOIN ${products} p ON p.id = pc.product_id
        WHERE pc.collection_id = "collections"."id" AND p.status = 'published' AND (p.published_at IS NULL OR p.published_at <= ${now.toISOString()}))`,
    })
    .from(collections)
    .where(eq(collections.status, "published"))
    .orderBy(desc(collections.createdAt));
  const media = await getMediaByIds(db, rows.map((r) => r.heroImageId).filter((v): v is string => Boolean(v)));
  return rows.map((r) => ({
    slug: r.slug,
    name: r.name,
    description: r.description,
    image: r.heroImageId ? (media.get(r.heroImageId) ?? null) : null,
    productCount: Number(r.productCount),
  }));
}

export async function getCollectionBySlug(db: Database, slug: string) {
  const [c] = await db
    .select()
    .from(collections)
    .where(and(eq(collections.slug, slug), eq(collections.status, "published")))
    .limit(1);
  if (!c) return null;
  const media = c.heroImageId ? await getMediaByIds(db, [c.heroImageId]) : new Map<string, MediaView>();
  return {
    slug: c.slug,
    name: c.name,
    description: c.description,
    seoTitle: c.seoTitle,
    seoDescription: c.seoDescription,
    image: c.heroImageId ? (media.get(c.heroImageId) ?? null) : null,
  };
}
