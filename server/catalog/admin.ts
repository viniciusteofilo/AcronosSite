import { and, asc, desc, eq, inArray, notInArray, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "@/db/client";
import {
  categories,
  collections,
  inventoryLevels,
  inventoryMovements,
  mediaAssets,
  orderItems,
  productCollections,
  productImages,
  products,
  productVariants,
  PUBLISH_STATUS,
  variantPrices,
} from "@/db/schema";
import { parseMoneyInput, SLUG_PATTERN } from "@/lib/slug";
import { UserError, authorize } from "@/server/admin/errors";
import { recordAudit } from "@/server/audit/log";
import { getMediaByIds, toMediaView, type MediaView } from "@/server/media/library";
import type { AccessContext } from "@/server/rbac/access";
import { hasPermission } from "@/server/rbac/permissions";
import { applyStockDelta } from "./inventory";

/** Currencies with a fixed price list (see the Phase 01 currency decision). */
export const PRICE_CURRENCIES = ["USD", "BRL"] as const;

// ---------------------------------------------------------------- validation

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .default(null);

const money = (label: string) =>
  z
    .string()
    .max(20)
    .default("")
    .transform((v, ctx) => {
      const parsed = parseMoneyInput(v);
      if (parsed === "invalid") {
        ctx.addIssue({ code: "custom", message: `${label} must be a number like 189.00` });
        return z.NEVER;
      }
      return parsed;
    });

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2, "Web address is too short")
  .max(80)
  .regex(SLUG_PATTERN, "Web address: use lowercase letters, numbers and hyphens");

const variantInput = z.object({
  id: z.uuid().optional(),
  sku: z
    .string()
    .trim()
    .toUpperCase()
    .min(2, "SKU is required")
    .max(60)
    .regex(/^[A-Z0-9][A-Z0-9._-]*$/, "SKU: use letters, numbers, hyphen, dot or underscore"),
  size: optionalText(20),
  color: optionalText(40),
  colorHex: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v.toLowerCase()))
    .pipe(z.string().regex(/^#[0-9a-f]{6}$/, "Color must be like #1a1a1a").nullable())
    .nullable()
    .default(null),
  usd: money("USD price"),
  usdCompare: money("USD compare-at price"),
  brl: money("BRL price"),
  brlCompare: money("BRL compare-at price"),
  /** Stock on hand the person wants to see after saving. */
  stock: z.number().int().min(0, "Stock cannot be negative").max(100_000),
  /** Stock on hand when the editor was opened (null for a new variant). Only the difference is applied. */
  stockWas: z.number().int().min(0).nullable().default(null),
  weightGrams: z.number().int().positive().max(100_000).nullable().default(null),
  isActive: z.boolean().default(true),
});

export const productInputSchema = z.object({
  id: z.uuid().optional(),
  expectedUpdatedAt: z.string().optional(),
  name: z.string().trim().min(2, "Name is required").max(120),
  slug: slugSchema,
  description: optionalText(5000),
  composition: optionalText(1000),
  care: optionalText(1000),
  technicalInfo: optionalText(3000),
  categoryId: z.uuid().nullable().default(null),
  collectionIds: z.array(z.uuid()).max(30).default([]),
  imageIds: z.array(z.uuid()).max(24, "Up to 24 photos per product").default([]),
  status: z.enum(PUBLISH_STATUS),
  publishAt: z.iso.datetime({ offset: true }).nullable().default(null),
  seoTitle: optionalText(70),
  seoDescription: optionalText(170),
  variants: z.array(variantInput).max(150, "Up to 150 variants per product").default([]),
});

export type ProductInput = z.input<typeof productInputSchema>;

// ---------------------------------------------------------------- list

export type AdminProductRow = {
  id: string;
  name: string;
  slug: string;
  status: (typeof PUBLISH_STATUS)[number];
  publishedAt: string | null;
  updatedAt: string;
  variants: number;
  available: number;
  minUsd: number | null;
  maxUsd: number | null;
  missingPrice: boolean;
  image: MediaView | null;
  category: string | null;
};

export const adminProductFilter = z.object({
  q: z.string().trim().max(80).optional(),
  status: z.enum([...PUBLISH_STATUS, "all"]).default("all"),
  page: z.coerce.number().int().min(1).max(1000).default(1),
});

export async function listAdminProducts(
  db: Database,
  actor: AccessContext | null,
  filter: z.input<typeof adminProductFilter>,
  pageSize = 50,
) {
  authorize(actor, "products:read");
  const f = adminProductFilter.parse(filter);
  const where: SQL[] = [];
  if (f.status !== "all") where.push(eq(products.status, f.status));
  if (f.q) {
    const term = `%${f.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    where.push(
      sql`(${products.name} ILIKE ${term} OR ${products.slug} ILIKE ${term} OR EXISTS (
        SELECT 1 FROM ${productVariants} v WHERE v.product_id = "products"."id" AND v.sku ILIKE ${term}))`,
    );
  }
  const rows = await db
    .select({
      id: products.id,
      name: products.name,
      slug: products.slug,
      status: products.status,
      publishedAt: products.publishedAt,
      updatedAt: products.updatedAt,
      category: categories.name,
      variants: sql<number>`(SELECT count(*) FROM ${productVariants} v WHERE v.product_id = "products"."id" AND v.is_active)`,
      available: sql<number>`(SELECT coalesce(sum(greatest(il.on_hand - il.reserved, 0)), 0) FROM ${productVariants} v
        JOIN ${inventoryLevels} il ON il.variant_id = v.id WHERE v.product_id = "products"."id" AND v.is_active)`,
      minUsd: sql<number | null>`(SELECT min(vp.amount_minor) FROM ${productVariants} v
        JOIN ${variantPrices} vp ON vp.variant_id = v.id AND vp.currency = 'USD' WHERE v.product_id = "products"."id" AND v.is_active)`,
      maxUsd: sql<number | null>`(SELECT max(vp.amount_minor) FROM ${productVariants} v
        JOIN ${variantPrices} vp ON vp.variant_id = v.id AND vp.currency = 'USD' WHERE v.product_id = "products"."id" AND v.is_active)`,
      unpriced: sql<number>`(SELECT count(*) FROM ${productVariants} v WHERE v.product_id = "products"."id" AND v.is_active
        AND NOT EXISTS (SELECT 1 FROM ${variantPrices} vp WHERE vp.variant_id = v.id AND vp.currency = 'USD'))`,
      imageId: sql<string | null>`(SELECT pi.media_asset_id FROM ${productImages} pi WHERE pi.product_id = "products"."id" ORDER BY pi.sort_order LIMIT 1)`,
      total: sql<number>`count(*) OVER ()`,
    })
    .from(products)
    .leftJoin(categories, eq(categories.id, products.categoryId))
    .where(where.length ? and(...where) : undefined)
    .orderBy(desc(products.updatedAt))
    .limit(pageSize)
    .offset((f.page - 1) * pageSize);

  const media = await getMediaByIds(db, rows.map((r) => r.imageId).filter((v): v is string => Boolean(v)));
  const counts = await db
    .select({ status: products.status, n: sql<number>`count(*)` })
    .from(products)
    .groupBy(products.status);
  const total = Number(rows[0]?.total ?? 0);
  return {
    filter: f,
    total,
    pages: Math.max(1, Math.ceil(total / pageSize)),
    counts: Object.fromEntries(counts.map((c) => [c.status, Number(c.n)])) as Partial<Record<(typeof PUBLISH_STATUS)[number], number>>,
    items: rows.map(
      (r): AdminProductRow => ({
        id: r.id,
        name: r.name,
        slug: r.slug,
        status: r.status,
        publishedAt: r.publishedAt?.toISOString() ?? null,
        updatedAt: r.updatedAt.toISOString(),
        variants: Number(r.variants),
        available: Number(r.available),
        minUsd: r.minUsd === null ? null : Number(r.minUsd),
        maxUsd: r.maxUsd === null ? null : Number(r.maxUsd),
        missingPrice: Number(r.unpriced) > 0 || Number(r.variants) === 0,
        image: r.imageId ? (media.get(r.imageId) ?? null) : null,
        category: r.category,
      }),
    ),
  };
}

// ---------------------------------------------------------------- load for editing

export type EditorVariant = {
  id: string;
  sku: string;
  size: string;
  color: string;
  colorHex: string;
  usd: number | null;
  usdCompare: number | null;
  brl: number | null;
  brlCompare: number | null;
  onHand: number;
  reserved: number;
  weightGrams: number | null;
  isActive: boolean;
  hasOrders: boolean;
};

export type EditorProduct = {
  id: string;
  updatedAt: string;
  name: string;
  slug: string;
  description: string;
  composition: string;
  care: string;
  technicalInfo: string;
  categoryId: string | null;
  collectionIds: string[];
  images: MediaView[];
  status: (typeof PUBLISH_STATUS)[number];
  publishedAt: string | null;
  seoTitle: string;
  seoDescription: string;
  variants: EditorVariant[];
};

export async function getProductForEditor(db: Database, actor: AccessContext | null, id: string): Promise<EditorProduct | null> {
  authorize(actor, "products:read");
  if (!z.uuid().safeParse(id).success) return null;
  const [p] = await db.select().from(products).where(eq(products.id, id)).limit(1);
  if (!p) return null;
  const [variants, prices, images, cols] = await Promise.all([
    db
      .select({
        v: productVariants,
        onHand: inventoryLevels.onHand,
        reserved: inventoryLevels.reserved,
        hasOrders: sql<boolean>`EXISTS (SELECT 1 FROM ${orderItems} oi WHERE oi.variant_id = ${productVariants.id})`,
      })
      .from(productVariants)
      .leftJoin(inventoryLevels, eq(inventoryLevels.variantId, productVariants.id))
      .where(eq(productVariants.productId, id))
      .orderBy(asc(productVariants.createdAt), asc(productVariants.sku)),
    db
      .select()
      .from(variantPrices)
      .where(sql`${variantPrices.variantId} IN (SELECT id FROM ${productVariants} WHERE product_id = ${id})`),
    db
      .select({ media: mediaAssets })
      .from(productImages)
      .innerJoin(mediaAssets, eq(mediaAssets.id, productImages.mediaAssetId))
      .where(eq(productImages.productId, id))
      .orderBy(asc(productImages.sortOrder)),
    db.select({ id: productCollections.collectionId }).from(productCollections).where(eq(productCollections.productId, id)),
  ]);
  const price = (variantId: string, currency: string) => prices.find((x) => x.variantId === variantId && x.currency === currency);
  return {
    id: p.id,
    updatedAt: p.updatedAt.toISOString(),
    name: p.name,
    slug: p.slug,
    description: p.description ?? "",
    composition: p.composition ?? "",
    care: p.care ?? "",
    technicalInfo: p.technicalInfo ?? "",
    categoryId: p.categoryId,
    collectionIds: cols.map((c) => c.id),
    images: images.map((i) => toMediaView(i.media)),
    status: p.status,
    publishedAt: p.publishedAt?.toISOString() ?? null,
    seoTitle: p.seoTitle ?? "",
    seoDescription: p.seoDescription ?? "",
    variants: variants.map(({ v, onHand, reserved, hasOrders }) => ({
      id: v.id,
      sku: v.sku,
      size: v.size ?? "",
      color: v.color ?? "",
      colorHex: v.colorHex ?? "",
      usd: price(v.id, "USD")?.amountMinor ?? null,
      usdCompare: price(v.id, "USD")?.compareAtMinor ?? null,
      brl: price(v.id, "BRL")?.amountMinor ?? null,
      brlCompare: price(v.id, "BRL")?.compareAtMinor ?? null,
      onHand: onHand ?? 0,
      reserved: reserved ?? 0,
      weightGrams: v.weightGrams,
      isActive: v.isActive,
      hasOrders: Boolean(hasOrders),
    })),
  };
}

// ---------------------------------------------------------------- save

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

/**
 * Creates or updates a product with everything on its edit screen, in one transaction.
 * Stock changes are applied as a difference (so a sale made while the screen was open is not lost)
 * and recorded as inventory movements. Returns the product id and a list of notes for the person.
 */
export async function saveProduct(
  db: Database,
  actor: AccessContext | null,
  raw: unknown,
  now: Date = new Date(),
): Promise<{ id: string; slug: string; notes: string[] }> {
  const ctx = authorize(actor, "products:write");
  const input = productInputSchema.parse(raw);
  const notes: string[] = [];

  // ---- checks that need no database
  const skus = new Set<string>();
  const combos = new Set<string>();
  for (const v of input.variants) {
    if (skus.has(v.sku)) throw new UserError(`SKU ${v.sku} appears twice.`, "variants");
    skus.add(v.sku);
    const combo = `${v.size ?? ""}|${(v.color ?? "").toLowerCase()}`;
    if (combos.has(combo)) throw new UserError(`Two variants have the same size and color (${[v.size, v.color].filter(Boolean).join(" / ") || "no options"}).`, "variants");
    combos.add(combo);
    for (const [amount, compare, cur] of [
      [v.usd, v.usdCompare, "USD"],
      [v.brl, v.brlCompare, "BRL"],
    ] as const) {
      if (compare !== null && amount === null) throw new UserError(`${v.sku}: a ${cur} compare-at price needs a ${cur} price.`, "variants");
      if (compare !== null && amount !== null && compare <= amount) {
        throw new UserError(`${v.sku}: the ${cur} compare-at price must be higher than the price (it shows as the old price).`, "variants");
      }
    }
  }
  if (input.status === "published" && !input.variants.some((v) => v.isActive && v.usd !== null)) {
    throw new UserError("To publish, add at least one active variant with a USD price.", "variants");
  }
  const stockChanges = input.variants.some((v) => (v.id ? v.stockWas !== null && v.stock !== v.stockWas : v.stock > 0));
  if (stockChanges && !hasPermission(ctx.roles, "inventory:adjust")) {
    throw new UserError("Your role cannot change stock. Ask a manager.", "variants");
  }

  return db.transaction(async (tx) => {
    let before: typeof products.$inferSelect | undefined;
    if (input.id) {
      [before] = await tx.select().from(products).where(eq(products.id, input.id)).for("update");
      if (!before) throw new UserError("This product no longer exists.");
      if (input.expectedUpdatedAt && before.updatedAt.toISOString() !== input.expectedUpdatedAt) {
        throw new UserError("Someone else saved this product after you opened it. Reload the page to see the latest version, then make your change again.");
      }
    }

    const publishAt = input.publishAt ? new Date(input.publishAt) : null;
    const publishedAt =
      input.status === "published" ? (publishAt ?? before?.publishedAt ?? now) : (publishAt ?? before?.publishedAt ?? null);
    const values = {
      name: input.name,
      slug: input.slug,
      description: input.description,
      composition: input.composition,
      care: input.care,
      technicalInfo: input.technicalInfo,
      categoryId: input.categoryId,
      status: input.status,
      publishedAt,
      seoTitle: input.seoTitle,
      seoDescription: input.seoDescription,
      updatedAt: now,
    };
    const [saved] = before
      ? await tx.update(products).set(values).where(eq(products.id, before.id)).returning()
      : await tx.insert(products).values({ ...values, createdAt: now }).returning();

    // ---- photos and collections: the list on screen is the truth, in its order
    await tx.delete(productImages).where(eq(productImages.productId, saved.id));
    const imageIds = [...new Set(input.imageIds)];
    if (imageIds.length) {
      await tx.insert(productImages).values(imageIds.map((mediaAssetId, sortOrder) => ({ productId: saved.id, mediaAssetId, sortOrder })));
    }
    await tx.delete(productCollections).where(eq(productCollections.productId, saved.id));
    const collectionIds = [...new Set(input.collectionIds)];
    if (collectionIds.length) {
      const existing = await tx
        .select({ id: sql<number>`coalesce(max(${productCollections.sortOrder}), -1)`, collectionId: productCollections.collectionId })
        .from(productCollections)
        .where(inArray(productCollections.collectionId, collectionIds))
        .groupBy(productCollections.collectionId);
      const nextOrder = new Map(existing.map((e) => [e.collectionId, Number(e.id) + 1]));
      await tx
        .insert(productCollections)
        .values(collectionIds.map((collectionId) => ({ productId: saved.id, collectionId, sortOrder: nextOrder.get(collectionId) ?? 0 })));
    }

    // ---- variants
    const current = await tx
      .select({ id: productVariants.id })
      .from(productVariants)
      .where(eq(productVariants.productId, saved.id));
    const currentIds = new Set(current.map((c) => c.id));
    for (const v of input.variants) {
      if (v.id && !currentIds.has(v.id)) throw new UserError("A variant on screen belongs to another product. Reload the page.");
    }
    const keptIds = input.variants.map((v) => v.id).filter((v): v is string => Boolean(v));
    const removed = [...currentIds].filter((id) => !keptIds.includes(id));
    if (removed.length) {
      const withOrders = await tx
        .selectDistinct({ id: orderItems.variantId })
        .from(orderItems)
        .where(inArray(orderItems.variantId, removed));
      const keep = new Set(withOrders.map((r) => r.id).filter((x): x is string => Boolean(x)));
      const deletable = removed.filter((id) => !keep.has(id));
      if (deletable.length) {
        // Free the SKUs first so they can be reused by the new rows below.
        await tx.delete(productVariants).where(inArray(productVariants.id, deletable));
      }
      if (keep.size) {
        await tx.update(productVariants).set({ isActive: false, updatedAt: now }).where(inArray(productVariants.id, [...keep]));
        notes.push(`${keep.size} variant(s) with past orders were hidden instead of deleted, to keep order history intact.`);
      }
    }

    for (const v of input.variants) {
      const fields = {
        sku: v.sku,
        size: v.size,
        color: v.color,
        colorHex: v.colorHex,
        weightGrams: v.weightGrams,
        isActive: v.isActive,
        updatedAt: now,
      };
      let variantId: string;
      if (v.id) {
        await tx.update(productVariants).set(fields).where(eq(productVariants.id, v.id));
        variantId = v.id;
      } else {
        const [row] = await tx.insert(productVariants).values({ ...fields, productId: saved.id }).returning({ id: productVariants.id });
        variantId = row.id;
      }
      await setPrices(tx, variantId, v, now);

      const delta = v.id ? (v.stockWas === null ? 0 : v.stock - v.stockWas) : v.stock;
      await applyStockDelta(tx, variantId, delta, now);
      if (delta !== 0) {
        await tx.insert(inventoryMovements).values({
          variantId,
          delta,
          reason: v.id ? "count_correction" : "receipt",
          note: "Product editor",
          actorId: ctx.userId,
          createdAt: now,
        });
      }
    }

    if (input.variants.some((v) => v.isActive && v.usd !== null && v.brl === null)) {
      notes.push("Some variants have no BRL price; Brazilian customers will see the USD price converted at checkout.");
    }
    if (input.status === "published" && imageIds.length === 0) notes.push("The product is published without photos.");
    if (input.status === "published" && publishedAt && publishedAt > now) {
      notes.push(`It will appear in the shop automatically on ${publishedAt.toUTCString()}.`);
    }

    await recordAudit(tx, {
      actorId: ctx.userId,
      action: before ? "product.update" : "product.create",
      entityType: "product",
      entityId: saved.id,
      before: before ? summary(before) : null,
      after: { ...summary(saved), variants: input.variants.length, images: imageIds.length },
    });
    return { id: saved.id, slug: saved.slug, notes };
  });
}

function summary(p: typeof products.$inferSelect) {
  return { name: p.name, slug: p.slug, status: p.status, publishedAt: p.publishedAt?.toISOString() ?? null };
}

async function setPrices(
  tx: Tx,
  variantId: string,
  v: { usd: number | null; usdCompare: number | null; brl: number | null; brlCompare: number | null },
  now: Date,
) {
  for (const [currency, amount, compare] of [
    ["USD", v.usd, v.usdCompare],
    ["BRL", v.brl, v.brlCompare],
  ] as const) {
    if (amount === null) {
      await tx.delete(variantPrices).where(and(eq(variantPrices.variantId, variantId), eq(variantPrices.currency, currency)));
    } else {
      await tx
        .insert(variantPrices)
        .values({ variantId, currency, amountMinor: amount, compareAtMinor: compare, updatedAt: now })
        .onConflictDoUpdate({
          target: [variantPrices.variantId, variantPrices.currency],
          set: { amountMinor: amount, compareAtMinor: compare, updatedAt: now },
        });
    }
  }
}

// ---------------------------------------------------------------- duplicate, archive, delete

/** Copies a product as a new draft (texts, photos, collections, variants and prices; stock starts at 0). */
export async function duplicateProduct(db: Database, actor: AccessContext | null, id: string): Promise<{ id: string }> {
  const ctx = authorize(actor, "products:write");
  const src = await getProductForEditor(db, ctx, id);
  if (!src) throw new UserError("This product no longer exists.");
  const taken = async (slug: string) => (await db.select({ id: products.id }).from(products).where(eq(products.slug, slug)).limit(1)).length > 0;
  let n = 1;
  let slug = `${src.slug}-copy`.slice(0, 80);
  while (await taken(slug)) slug = `${src.slug}-copy-${++n}`.slice(0, 80);
  const skuTaken = async (sku: string) => (await db.select({ id: productVariants.id }).from(productVariants).where(eq(productVariants.sku, sku)).limit(1)).length > 0;
  const variants = [];
  for (const v of src.variants.filter((x) => x.isActive)) {
    let k = 1;
    let sku = `${v.sku}-COPY`.slice(0, 60);
    while (await skuTaken(sku)) sku = `${v.sku}-COPY${++k}`.slice(0, 60);
    const m = (x: number | null) => (x === null ? "" : (x / 100).toFixed(2));
    variants.push({ sku, size: v.size, color: v.color, colorHex: v.colorHex, usd: m(v.usd), usdCompare: m(v.usdCompare), brl: m(v.brl), brlCompare: m(v.brlCompare), stock: 0, weightGrams: v.weightGrams, isActive: true });
  }
  const res = await saveProduct(db, ctx, {
    name: `${src.name} (copy)`.slice(0, 120),
    slug,
    description: src.description,
    composition: src.composition,
    care: src.care,
    technicalInfo: src.technicalInfo,
    categoryId: src.categoryId,
    collectionIds: src.collectionIds,
    imageIds: src.images.map((i) => i.id),
    status: "draft",
    seoTitle: "",
    seoDescription: "",
    variants,
  });
  return { id: res.id };
}

/**
 * Deletes a product that was never sold. Products with orders must be archived instead,
 * so order history and reports stay complete.
 */
export async function deleteProduct(db: Database, actor: AccessContext | null, id: string): Promise<void> {
  const ctx = authorize(actor, "products:write");
  await db.transaction(async (tx) => {
    const [p] = await tx.select().from(products).where(eq(products.id, id)).for("update");
    if (!p) throw new UserError("This product no longer exists.");
    const [sold] = await tx
      .select({ id: orderItems.id })
      .from(orderItems)
      .innerJoin(productVariants, eq(productVariants.id, orderItems.variantId))
      .where(eq(productVariants.productId, id))
      .limit(1);
    if (sold) throw new UserError("This product has orders, so it cannot be deleted. Set it to Archived to hide it.");
    await tx.delete(products).where(eq(products.id, id));
    await recordAudit(tx, { actorId: ctx.userId, action: "product.delete", entityType: "product", entityId: id, before: summary(p) });
  });
}

// ---------------------------------------------------------------- categories

const categoryInput = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(2, "Name is required").max(60),
  slug: slugSchema,
  sortOrder: z.number().int().min(0).max(999).default(0),
});

export async function listCategoriesAdmin(db: Database, actor: AccessContext | null) {
  authorize(actor, "products:read");
  return db
    .select({
      id: categories.id,
      name: categories.name,
      slug: categories.slug,
      sortOrder: categories.sortOrder,
      products: sql<number>`(SELECT count(*)::int FROM ${products} p WHERE p.category_id = "categories"."id")`,
    })
    .from(categories)
    .orderBy(asc(categories.sortOrder), asc(categories.name));
}

export async function saveCategory(db: Database, actor: AccessContext | null, raw: unknown) {
  const ctx = authorize(actor, "products:write");
  const input = categoryInput.parse(raw);
  return db.transaction(async (tx) => {
    const [row] = input.id
      ? await tx.update(categories).set({ name: input.name, slug: input.slug, sortOrder: input.sortOrder, updatedAt: new Date() }).where(eq(categories.id, input.id)).returning()
      : await tx.insert(categories).values({ name: input.name, slug: input.slug, sortOrder: input.sortOrder }).returning();
    if (!row) throw new UserError("This category no longer exists.");
    await recordAudit(tx, { actorId: ctx.userId, action: input.id ? "category.update" : "category.create", entityType: "category", entityId: row.id, after: input });
    return { id: row.id, name: row.name, slug: row.slug };
  });
}

/** Products in a deleted category simply lose their category; nothing else changes. */
export async function deleteCategory(db: Database, actor: AccessContext | null, id: string) {
  const ctx = authorize(actor, "products:write");
  await db.transaction(async (tx) => {
    const [row] = await tx.delete(categories).where(eq(categories.id, id)).returning();
    if (!row) throw new UserError("This category no longer exists.");
    await recordAudit(tx, { actorId: ctx.userId, action: "category.delete", entityType: "category", entityId: id, before: { name: row.name, slug: row.slug } });
  });
}

/** Options for the product editor's selects. */
export async function getProductEditorOptions(db: Database, actor: AccessContext | null) {
  authorize(actor, "products:read");
  const [cats, cols, colors] = await Promise.all([
    db.select({ id: categories.id, name: categories.name }).from(categories).orderBy(asc(categories.sortOrder), asc(categories.name)),
    db.select({ id: collections.id, name: collections.name, status: collections.status }).from(collections).orderBy(desc(collections.createdAt)),
    db
      .selectDistinct({ color: productVariants.color, hex: productVariants.colorHex })
      .from(productVariants)
      .where(and(sql`${productVariants.color} IS NOT NULL`, notInArray(productVariants.color, [""]))),
  ]);
  return { categories: cats, collections: cols, knownColors: colors.map((c) => ({ name: c.color!, hex: c.hex ?? "" })) };
}
