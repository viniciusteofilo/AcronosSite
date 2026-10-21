import { and, asc, desc, eq, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "@/db/client";
import { INVENTORY_REASONS, inventoryLevels, inventoryMovements, products, productVariants, users } from "@/db/schema";
import { UserError, authorize } from "@/server/admin/errors";
import { recordAudit } from "@/server/audit/log";
import type { AccessContext } from "@/server/rbac/access";

/** Reasons a person can choose by hand. "sale" and "return" come from orders (Phase 05). */
export const MANUAL_REASONS = ["receipt", "manual_adjustment", "damage", "count_correction", "return"] as const;

export const REASON_LABELS: Record<(typeof INVENTORY_REASONS)[number], string> = {
  receipt: "Received from production",
  manual_adjustment: "Manual adjustment",
  sale: "Sale",
  return: "Customer return",
  damage: "Damaged / lost",
  count_correction: "Stock count correction",
};

export const inventoryFilter = z.object({
  q: z.string().trim().max(80).optional(),
  view: z.enum(["all", "low", "out"]).default("all"),
});

export async function listInventory(db: Database, actor: AccessContext | null, raw: z.input<typeof inventoryFilter>) {
  authorize(actor, "inventory:adjust");
  const f = inventoryFilter.parse(raw);
  const available = sql<number>`greatest(coalesce(${inventoryLevels.onHand}, 0) - coalesce(${inventoryLevels.reserved}, 0), 0)`;
  const where: SQL[] = [eq(productVariants.isActive, true)];
  if (f.q) {
    const term = `%${f.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    where.push(sql`(${products.name} ILIKE ${term} OR ${productVariants.sku} ILIKE ${term})`);
  }
  if (f.view === "low") where.push(sql`${available} > 0 AND ${available} <= coalesce(${inventoryLevels.lowStockThreshold}, 2)`);
  if (f.view === "out") where.push(sql`${available} = 0`);
  const rows = await db
    .select({
      variantId: productVariants.id,
      productId: products.id,
      productName: products.name,
      productStatus: products.status,
      sku: productVariants.sku,
      size: productVariants.size,
      color: productVariants.color,
      onHand: sql<number>`coalesce(${inventoryLevels.onHand}, 0)`,
      reserved: sql<number>`coalesce(${inventoryLevels.reserved}, 0)`,
      threshold: sql<number>`coalesce(${inventoryLevels.lowStockThreshold}, 2)`,
      available,
    })
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .leftJoin(inventoryLevels, eq(inventoryLevels.variantId, productVariants.id))
    .where(and(...where))
    .orderBy(asc(products.name), asc(productVariants.sku))
    .limit(1000);
  return {
    filter: f,
    items: rows.map((r) => ({
      ...r,
      onHand: Number(r.onHand),
      reserved: Number(r.reserved),
      threshold: Number(r.threshold),
      available: Number(r.available),
    })),
  };
}

const adjustInput = z.object({
  variantId: z.uuid(),
  delta: z.number().int().min(-100_000).max(100_000).refine((v) => v !== 0, "Enter a quantity other than 0"),
  reason: z.enum(MANUAL_REASONS),
  note: z
    .string()
    .trim()
    .max(300)
    .transform((v) => v || null)
    .nullable()
    .default(null),
});

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

/**
 * The single place stock on hand changes. Ensures the row exists, then adds the difference in
 * one UPDATE so concurrent changes add up. The database check constraints refuse negative stock
 * and stock below the units reserved by open orders.
 */
export async function applyStockDelta(tx: Tx, variantId: string, delta: number, now: Date) {
  await tx.insert(inventoryLevels).values({ variantId, onHand: 0, updatedAt: now }).onConflictDoNothing();
  const [level] = await tx
    .update(inventoryLevels)
    .set({ onHand: sql`${inventoryLevels.onHand} + ${delta}`, updatedAt: now })
    .where(eq(inventoryLevels.variantId, variantId))
    .returning();
  return level;
}

/** Adds or removes units atomically and records why. The database refuses to go below reserved units. */
export async function adjustStock(db: Database, actor: AccessContext | null, raw: unknown, now: Date = new Date()) {
  const ctx = authorize(actor, "inventory:adjust");
  const input = adjustInput.parse(raw);
  return db.transaction(async (tx) => {
    const [variant] = await tx.select({ id: productVariants.id, sku: productVariants.sku }).from(productVariants).where(eq(productVariants.id, input.variantId));
    if (!variant) throw new UserError("This variant no longer exists.");
    const level = await applyStockDelta(tx, input.variantId, input.delta, now);
    await tx.insert(inventoryMovements).values({ ...input, actorId: ctx.userId, createdAt: now });
    await recordAudit(tx, {
      actorId: ctx.userId,
      action: "inventory.adjust",
      entityType: "product_variant",
      entityId: input.variantId,
      after: { sku: variant.sku, delta: input.delta, reason: input.reason, onHand: level.onHand },
    });
    return { onHand: level.onHand, reserved: level.reserved };
  });
}

export async function setLowStockThreshold(db: Database, actor: AccessContext | null, variantId: string, threshold: number) {
  authorize(actor, "inventory:adjust");
  const t = z.number().int().min(0).max(10_000).parse(threshold);
  await db
    .insert(inventoryLevels)
    .values({ variantId: z.uuid().parse(variantId), onHand: 0, lowStockThreshold: t })
    .onConflictDoUpdate({ target: inventoryLevels.variantId, set: { lowStockThreshold: t, updatedAt: new Date() } });
}

export async function listMovements(db: Database, actor: AccessContext | null, variantId: string, limit = 50) {
  authorize(actor, "inventory:adjust");
  const rows = await db
    .select({
      id: inventoryMovements.id,
      delta: inventoryMovements.delta,
      reason: inventoryMovements.reason,
      note: inventoryMovements.note,
      createdAt: inventoryMovements.createdAt,
      actor: users.email,
    })
    .from(inventoryMovements)
    .leftJoin(users, eq(users.id, inventoryMovements.actorId))
    .where(eq(inventoryMovements.variantId, z.uuid().parse(variantId)))
    .orderBy(desc(inventoryMovements.createdAt))
    .limit(limit);
  return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString(), reasonLabel: REASON_LABELS[r.reason] }));
}
