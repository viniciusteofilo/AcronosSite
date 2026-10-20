import type { Database } from "@/db/client";
import { formatMoney } from "@/lib/money";
import { toCard, type ProductCardData } from "@/components/storefront/product-card";
import type { HomeBlocks } from "@/server/content/home";
import { listProducts, shopFilterSchema, STORE_CURRENCY } from "./queries";

/** Products for the homepage: the newest four, or the ones picked in the site editor (in that order). */
export async function getFeaturedProducts(db: Database, blocks: HomeBlocks): Promise<ProductCardData[]> {
  const fp = blocks.featuredProducts;
  const manual = fp.mode === "manual" && fp.productIds.length > 0;
  const { items } = await listProducts(db, shopFilterSchema.parse({}), {
    limit: manual ? fp.productIds.length : 4,
    ids: manual ? fp.productIds : undefined,
  });
  const ordered = manual ? fp.productIds.map((id) => items.find((i) => i.id === id)).filter((i) => i !== undefined) : items;
  return ordered.map((p) => toCard(p, (m) => formatMoney(m, STORE_CURRENCY)));
}
