import { afterAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import {
  auditLogs,
  inventoryLevels,
  orders,
  paymentEvents,
  productVariants,
  products,
} from "@/db/schema";
import { recordAudit } from "@/server/audit/log";
import { makeMerchant, makeOrder, pgErrorCode, testDb } from "../helpers";

const { db, client } = testDb();
afterAll(() => client.end());

const CHECK_VIOLATION = "23514";
const UNIQUE_VIOLATION = "23505";
const INSUFFICIENT_PRIVILEGE = "42501";

async function makeVariant() {
  const [p] = await db
    .insert(products)
    .values({ slug: `p-${crypto.randomUUID()}`, name: "Test product" })
    .returning();
  const [v] = await db
    .insert(productVariants)
    .values({ productId: p.id, sku: `SKU-${crypto.randomUUID()}` })
    .returning();
  return v;
}

describe("the audit log is append-only", () => {
  it("rejects UPDATE and DELETE at the database level", async () => {
    await recordAudit(db, { actorId: null, action: "test.event", entityType: "test", entityId: "x" });
    const [row] = await db.select().from(auditLogs).where(eq(auditLogs.action, "test.event")).limit(1);

    expect(
      await pgErrorCode(() => db.update(auditLogs).set({ action: "tampered" }).where(eq(auditLogs.id, row.id))),
    ).toBe(INSUFFICIENT_PRIVILEGE);
    expect(await pgErrorCode(() => db.delete(auditLogs).where(eq(auditLogs.id, row.id)))).toBe(
      INSUFFICIENT_PRIVILEGE,
    );
  });
});

describe("inventory cannot be oversold", () => {
  it("rejects negative stock", async () => {
    const v = await makeVariant();
    expect(await pgErrorCode(() => db.insert(inventoryLevels).values({ variantId: v.id, onHand: -1 }))).toBe(
      CHECK_VIOLATION,
    );
  });

  it("rejects reserving more than is on hand", async () => {
    const v = await makeVariant();
    await db.insert(inventoryLevels).values({ variantId: v.id, onHand: 3, reserved: 0 });
    expect(
      await pgErrorCode(() =>
        db.update(inventoryLevels).set({ reserved: 4 }).where(eq(inventoryLevels.variantId, v.id)),
      ),
    ).toBe(CHECK_VIOLATION);
  });

  it("two concurrent reservations of the last unit: exactly one succeeds", async () => {
    const v = await makeVariant();
    await db.insert(inventoryLevels).values({ variantId: v.id, onHand: 1, reserved: 0 });
    // Atomic increment guarded by the CHECK constraint, the way the checkout will reserve stock.
    const atomicReserve = () =>
      db
        .update(inventoryLevels)
        .set({ reserved: sql`${inventoryLevels.reserved} + 1` })
        .where(eq(inventoryLevels.variantId, v.id));
    const results = await Promise.allSettled([atomicReserve(), atomicReserve()]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const [level] = await db.select().from(inventoryLevels).where(eq(inventoryLevels.variantId, v.id));
    expect(level.reserved).toBe(1);
  });
});

describe("orders and payments", () => {
  it("rejects an order whose total does not add up", async () => {
    const merchant = await makeMerchant(db);
    expect(
      await pgErrorCode(() =>
        db.insert(orders).values({
          number: `BAD-${crypto.randomUUID()}`,
          email: "x@example.test",
          merchantEntityId: merchant.id,
          currency: "USD",
          subtotalMinor: 10_000,
          totalMinor: 1, // tampered total
          idempotencyKey: crypto.randomUUID(),
        }),
      ),
    ).toBe(CHECK_VIOLATION);
  });

  it("rejects a second order with the same idempotency key (no duplicate orders)", async () => {
    const merchant = await makeMerchant(db);
    const first = await makeOrder(db, { userId: null, merchantId: merchant.id });
    expect(
      await pgErrorCode(() =>
        db.insert(orders).values({
          number: `DUP-${crypto.randomUUID()}`,
          email: "x@example.test",
          merchantEntityId: merchant.id,
          currency: "USD",
          subtotalMinor: 100,
          totalMinor: 100,
          idempotencyKey: first.idempotencyKey,
        }),
      ),
    ).toBe(UNIQUE_VIOLATION);
  });

  it("stores a provider webhook event only once (replay protection)", async () => {
    const event = { provider: "stripe" as const, providerEventId: "evt_test_123", type: "checkout.session.completed", payload: {} };
    await db.insert(paymentEvents).values(event);
    expect(await pgErrorCode(() => db.insert(paymentEvents).values(event))).toBe(UNIQUE_VIOLATION);
  });
});
