import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "@/db/client";
import { cartItems, carts, inventoryLevels, productImages, products, productVariants, variantPrices } from "@/db/schema";
import { UserError } from "@/server/admin/errors";
import { getMediaByIds, type MediaView } from "@/server/media/library";

export const CART_COOKIE = "acn_cart";
export const MAX_PER_LINE = 20;

export type CartLine = {
  variantId: string;
  productName: string;
  productSlug: string;
  sku: string;
  size: string | null;
  color: string | null;
  quantity: number;
  /** Unit price per currency in minor units (only currencies with a price list entry). */
  prices: Record<string, number>;
  available: number;
  image: MediaView | null;
  /** Why this line cannot be bought as it is, if anything. */
  problem: string | null;
};

export type CartView = { id: string | null; lines: CartLine[]; count: number; subtotalUsd: number; hasProblems: boolean };

const EMPTY: CartView = { id: null, lines: [], count: 0, subtotalUsd: 0, hasProblems: false };

/** Product visible in the shop right now (same rule as the storefront). */
const sellable = (now: Date) =>
  and(eq(products.status, "published"), sql`(${products.publishedAt} IS NULL OR ${products.publishedAt} <= ${now.toISOString()})`, eq(productVariants.isActive, true));

export async function getCart(db: Database, cartId: string | undefined | null, now: Date = new Date()): Promise<CartView> {
  if (!cartId || !z.uuid().safeParse(cartId).success) return EMPTY;
  const rows = await db
    .select({
      variantId: cartItems.variantId,
      quantity: cartItems.quantity,
      productName: products.name,
      productSlug: products.slug,
      productId: products.id,
      sku: productVariants.sku,
      size: productVariants.size,
      color: productVariants.color,
      visible: sql<boolean>`(${products.status} = 'published' AND (${products.publishedAt} IS NULL OR ${products.publishedAt} <= ${now.toISOString()}) AND ${productVariants.isActive})`,
      available: sql<number>`greatest(coalesce(${inventoryLevels.onHand}, 0) - coalesce(${inventoryLevels.reserved}, 0), 0)`,
      imageId: sql<string | null>`(SELECT pi.media_asset_id FROM ${productImages} pi WHERE pi.product_id = "products"."id" ORDER BY pi.sort_order LIMIT 1)`,
    })
    .from(cartItems)
    .innerJoin(productVariants, eq(productVariants.id, cartItems.variantId))
    .innerJoin(products, eq(products.id, productVariants.productId))
    .leftJoin(inventoryLevels, eq(inventoryLevels.variantId, productVariants.id))
    .where(eq(cartItems.cartId, cartId))
    .orderBy(products.name, productVariants.sku);
  if (rows.length === 0) return { ...EMPTY, id: cartId };
  const [prices, media] = await Promise.all([
    db.select().from(variantPrices).where(inArray(variantPrices.variantId, rows.map((r) => r.variantId))),
    getMediaByIds(db, rows.map((r) => r.imageId).filter((v): v is string => Boolean(v))),
  ]);
  const lines: CartLine[] = rows.map((r) => {
    const p = Object.fromEntries(prices.filter((x) => x.variantId === r.variantId).map((x) => [x.currency, x.amountMinor]));
    const available = Number(r.available);
    const problem = !r.visible || p.USD === undefined ? "No longer available." : available === 0 ? "Sold out." : r.quantity > available ? `Only ${available} left.` : null;
    return {
      variantId: r.variantId,
      productName: r.productName,
      productSlug: r.productSlug,
      sku: r.sku,
      size: r.size,
      color: r.color,
      quantity: r.quantity,
      prices: p,
      available,
      image: r.imageId ? (media.get(r.imageId) ?? null) : null,
      problem,
    };
  });
  return {
    id: cartId,
    lines,
    count: lines.reduce((s, l) => s + l.quantity, 0),
    subtotalUsd: lines.reduce((s, l) => s + (l.prices.USD ?? 0) * l.quantity, 0),
    hasProblems: lines.some((l) => l.problem),
  };
}

const addInput = z.object({ variantId: z.uuid(), quantity: z.coerce.number().int().min(1).max(MAX_PER_LINE).default(1) });

/** Adds units of a variant. Creates the cart when needed and returns its id (kept in a cookie). */
export async function addToCart(db: Database, cartId: string | null | undefined, raw: unknown, userId: string | null = null, now: Date = new Date()): Promise<string> {
  const { variantId, quantity } = addInput.parse(raw);
  const [v] = await db
    .select({
      id: productVariants.id,
      available: sql<number>`greatest(coalesce(${inventoryLevels.onHand}, 0) - coalesce(${inventoryLevels.reserved}, 0), 0)`,
      usd: variantPrices.amountMinor,
    })
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .innerJoin(variantPrices, and(eq(variantPrices.variantId, productVariants.id), eq(variantPrices.currency, "USD")))
    .leftJoin(inventoryLevels, eq(inventoryLevels.variantId, productVariants.id))
    .where(and(eq(productVariants.id, variantId), sellable(now)))
    .limit(1);
  if (!v) throw new UserError("This item is not available.");
  let id = cartId && z.uuid().safeParse(cartId).success ? cartId : null;
  if (id) {
    const [exists] = await db.select({ id: carts.id }).from(carts).where(eq(carts.id, id)).limit(1);
    if (!exists) id = null;
  }
  if (!id) {
    const [c] = await db.insert(carts).values({ currency: "USD", userId }).returning({ id: carts.id });
    id = c.id;
  }
  const [line] = await db.select({ q: cartItems.quantity }).from(cartItems).where(and(eq(cartItems.cartId, id), eq(cartItems.variantId, variantId)));
  const next = Math.min(MAX_PER_LINE, (line?.q ?? 0) + quantity);
  if (next > Number(v.available)) {
    throw new UserError(Number(v.available) === 0 ? "This size is sold out." : `Only ${v.available} available${line ? ` (you already have ${line.q} in your cart)` : ""}.`);
  }
  await db
    .insert(cartItems)
    .values({ cartId: id, variantId, quantity: next })
    .onConflictDoUpdate({ target: [cartItems.cartId, cartItems.variantId], set: { quantity: next } });
  await db.update(carts).set({ updatedAt: now, ...(userId ? { userId } : {}) }).where(eq(carts.id, id));
  return id;
}

/** Sets the quantity of a line; 0 removes it. */
export async function setCartQuantity(db: Database, cartId: string | null | undefined, raw: unknown) {
  const { variantId, quantity } = z.object({ variantId: z.uuid(), quantity: z.coerce.number().int().min(0).max(MAX_PER_LINE) }).parse(raw);
  if (!cartId || !z.uuid().safeParse(cartId).success) return;
  if (quantity === 0) {
    await db.delete(cartItems).where(and(eq(cartItems.cartId, cartId), eq(cartItems.variantId, variantId)));
    return;
  }
  const [lvl] = await db
    .select({ available: sql<number>`greatest(coalesce(${inventoryLevels.onHand}, 0) - coalesce(${inventoryLevels.reserved}, 0), 0)` })
    .from(productVariants)
    .leftJoin(inventoryLevels, eq(inventoryLevels.variantId, productVariants.id))
    .where(eq(productVariants.id, variantId));
  if (lvl && quantity > Number(lvl.available)) throw new UserError(`Only ${lvl.available} available.`);
  await db.update(cartItems).set({ quantity }).where(and(eq(cartItems.cartId, cartId), eq(cartItems.variantId, variantId)));
}

export async function clearCart(db: Pick<Database, "delete">, cartId: string) {
  await db.delete(cartItems).where(eq(cartItems.cartId, cartId));
}
