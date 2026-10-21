import { asc, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "@/db/client";
import { collections, productCollections, productImages, products, PUBLISH_STATUS } from "@/db/schema";
import { UserError, authorize } from "@/server/admin/errors";
import { recordAudit } from "@/server/audit/log";
import { getMediaByIds, type MediaView } from "@/server/media/library";
import type { AccessContext } from "@/server/rbac/access";
import { slugSchema } from "./admin";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => v || null)
    .nullable()
    .default(null);

export const collectionInputSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(2, "Name is required").max(80),
  slug: slugSchema,
  description: optionalText(1200),
  heroImageId: z.uuid().nullable().default(null),
  status: z.enum(PUBLISH_STATUS),
  seoTitle: optionalText(70),
  seoDescription: optionalText(170),
  /** Products in the order they appear on the collection page. */
  productIds: z.array(z.uuid()).max(300).default([]),
});

export async function listAdminCollections(db: Database, actor: AccessContext | null) {
  authorize(actor, "products:read");
  const rows = await db
    .select({
      id: collections.id,
      name: collections.name,
      slug: collections.slug,
      status: collections.status,
      heroImageId: collections.heroImageId,
      updatedAt: collections.updatedAt,
      products: sql<number>`(SELECT count(*)::int FROM ${productCollections} pc WHERE pc.collection_id = "collections"."id")`,
    })
    .from(collections)
    .orderBy(desc(collections.updatedAt));
  const media = await getMediaByIds(db, rows.map((r) => r.heroImageId).filter((v): v is string => Boolean(v)));
  return rows.map((r) => ({
    ...r,
    updatedAt: r.updatedAt.toISOString(),
    image: r.heroImageId ? (media.get(r.heroImageId) ?? null) : null,
  }));
}

export type EditorCollection = {
  id: string | null;
  name: string;
  slug: string;
  description: string;
  hero: MediaView | null;
  status: (typeof PUBLISH_STATUS)[number];
  seoTitle: string;
  seoDescription: string;
  productIds: string[];
};

export async function getCollectionForEditor(db: Database, actor: AccessContext | null, id: string): Promise<EditorCollection | null> {
  authorize(actor, "products:read");
  if (!z.uuid().safeParse(id).success) return null;
  const [c] = await db.select().from(collections).where(eq(collections.id, id)).limit(1);
  if (!c) return null;
  const links = await db
    .select({ id: productCollections.productId })
    .from(productCollections)
    .where(eq(productCollections.collectionId, id))
    .orderBy(asc(productCollections.sortOrder));
  const hero = c.heroImageId ? ((await getMediaByIds(db, [c.heroImageId])).get(c.heroImageId) ?? null) : null;
  return {
    id: c.id,
    name: c.name,
    slug: c.slug,
    description: c.description ?? "",
    hero,
    status: c.status,
    seoTitle: c.seoTitle ?? "",
    seoDescription: c.seoDescription ?? "",
    productIds: links.map((l) => l.id),
  };
}

/** Every product (any status) for the collection product picker. */
export async function listProductChoices(db: Database, actor: AccessContext | null) {
  authorize(actor, "products:read");
  const rows = await db
    .select({
      id: products.id,
      name: products.name,
      status: products.status,
      imageId: sql<string | null>`(SELECT pi.media_asset_id FROM ${productImages} pi WHERE pi.product_id = "products"."id" ORDER BY pi.sort_order LIMIT 1)`,
    })
    .from(products)
    .orderBy(asc(products.name));
  const media = await getMediaByIds(db, rows.map((r) => r.imageId).filter((v): v is string => Boolean(v)));
  return rows.map((r) => ({ id: r.id, name: r.name, status: r.status, image: r.imageId ? (media.get(r.imageId) ?? null) : null }));
}

export async function saveCollection(db: Database, actor: AccessContext | null, raw: unknown): Promise<{ id: string; slug: string }> {
  const ctx = authorize(actor, "products:write");
  const input = collectionInputSchema.parse(raw);
  return db.transaction(async (tx) => {
    const values = {
      name: input.name,
      slug: input.slug,
      description: input.description,
      heroImageId: input.heroImageId,
      status: input.status,
      seoTitle: input.seoTitle,
      seoDescription: input.seoDescription,
      updatedAt: new Date(),
    };
    let before: typeof collections.$inferSelect | undefined;
    if (input.id) {
      [before] = await tx.select().from(collections).where(eq(collections.id, input.id)).for("update");
      if (!before) throw new UserError("This collection no longer exists.");
    }
    const [row] = before
      ? await tx.update(collections).set(values).where(eq(collections.id, before.id)).returning()
      : await tx.insert(collections).values(values).returning();
    await tx.delete(productCollections).where(eq(productCollections.collectionId, row.id));
    const ids = [...new Set(input.productIds)];
    if (ids.length) {
      await tx.insert(productCollections).values(ids.map((productId, sortOrder) => ({ productId, collectionId: row.id, sortOrder })));
    }
    await recordAudit(tx, {
      actorId: ctx.userId,
      action: before ? "collection.update" : "collection.create",
      entityType: "collection",
      entityId: row.id,
      before: before ? { name: before.name, slug: before.slug, status: before.status } : null,
      after: { name: row.name, slug: row.slug, status: row.status, products: ids.length },
    });
    return { id: row.id, slug: row.slug };
  });
}

/** Deleting a collection never deletes its products; they just leave the collection. */
export async function deleteCollection(db: Database, actor: AccessContext | null, id: string) {
  const ctx = authorize(actor, "products:write");
  await db.transaction(async (tx) => {
    const [row] = await tx.delete(collections).where(eq(collections.id, id)).returning();
    if (!row) throw new UserError("This collection no longer exists.");
    await recordAudit(tx, { actorId: ctx.userId, action: "collection.delete", entityType: "collection", entityId: id, before: { name: row.name, slug: row.slug } });
  });
}
