import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { auditLogs, inventoryLevels, inventoryMovements, mediaAssets, orderItems, productVariants, products, variantPrices } from "@/db/schema";
import { parseMoneyInput, slugify, codeOf } from "@/lib/slug";
import { runAdmin } from "@/server/admin/errors";
import {
  deleteProduct,
  duplicateProduct,
  getProductForEditor,
  listAdminProducts,
  saveCategory,
  saveProduct,
} from "@/server/catalog/admin";
import { deleteCollection, getCollectionForEditor, saveCollection } from "@/server/catalog/collections-admin";
import { adjustStock, listInventory, listMovements } from "@/server/catalog/inventory";
import { getCollectionBySlug, getProductBySlug, listProducts, shopFilterSchema } from "@/server/catalog/queries";
import { AccessDeniedError } from "@/server/rbac/access";
import { ctxFor, makeMerchant, makeOrder, makeUser, testDb } from "../helpers";

const { db, client } = testDb();
afterAll(() => client.end());

const T = `a${Date.now().toString(36)}`;
let manager: ReturnType<typeof ctxFor>;
let editor: ReturnType<typeof ctxFor>;
let imageId: string;

beforeAll(async () => {
  manager = ctxFor(await makeUser(db, { roles: ["manager"], twoFactorEnabled: true }), ["manager"]);
  editor = ctxFor(await makeUser(db, { roles: ["content_editor"], twoFactorEnabled: true }), ["content_editor"]);
  const [m] = await db
    .insert(mediaAssets)
    .values({ storageKey: `media/2026/10/${crypto.randomUUID()}-640.webp`, contentType: "image/webp", byteSize: 100, width: 640, height: 800, renditions: [] })
    .returning();
  imageId = m.id;
});

const base = (over: Record<string, unknown> = {}) => ({
  name: `Shell jacket ${T}`,
  slug: `shell-jacket-${T}`,
  status: "draft",
  description: "Water-repellent shell.",
  imageIds: [] as string[],
  variants: [
    { sku: `SJ-${T}-BLK-M`, size: "M", color: "Black", colorHex: "#111111", usd: "189.00", brl: "990,00", stock: 4 },
    { sku: `SJ-${T}-BLK-L`, size: "L", color: "Black", colorHex: "#111111", usd: "189", stock: 0 },
  ],
  ...over,
});

describe("helpers", () => {
  it("parses prices typed in different ways into cents", () => {
    expect(parseMoneyInput("189")).toBe(18900);
    expect(parseMoneyInput("189.9")).toBe(18990);
    expect(parseMoneyInput("990,50")).toBe(99050);
    expect(parseMoneyInput("1,299.00")).toBe(129900);
    expect(parseMoneyInput("1.299,00")).toBe(129900);
    expect(parseMoneyInput("R$ 990,00")).toBe(99000);
    expect(parseMoneyInput("")).toBeNull();
    expect(parseMoneyInput("abc")).toBe("invalid");
    expect(parseMoneyInput("-5")).toBe("invalid");
  });
  it("suggests slugs and codes", () => {
    expect(slugify("Shell Jacket — Drop 01 Ção")).toBe("shell-jacket-drop-01-cao");
    expect(codeOf("Black")).toBe("BLK");
    expect(codeOf("Off white")).toBe("OFFW");
  });
});

describe("products admin", () => {
  let productId: string;

  it("only staff with products:write can save; content editors can only read", async () => {
    await expect(saveProduct(db, editor, base())).rejects.toBeInstanceOf(AccessDeniedError);
    await expect(saveProduct(db, null, base())).rejects.toBeInstanceOf(AccessDeniedError);
    const noMfa = ctxFor(await makeUser(db, { roles: ["manager"] }), ["manager"], { twoFactorEnabled: false });
    await expect(saveProduct(db, noMfa, base())).rejects.toBeInstanceOf(AccessDeniedError);
    await expect(listAdminProducts(db, editor, {})).resolves.toBeTruthy();
  });

  it("creates a draft with variants, prices in USD and BRL, stock and an audit entry", async () => {
    const res = await saveProduct(db, manager, base({ imageIds: [imageId] }));
    productId = res.id;
    const p = await getProductForEditor(db, manager, productId);
    expect(p?.variants).toHaveLength(2);
    const m = p!.variants.find((v) => v.size === "M")!;
    expect(m).toMatchObject({ usd: 18900, brl: 99000, onHand: 4 });
    expect(p!.variants.find((v) => v.size === "L")!.brl).toBeNull();
    expect(p!.images.map((i) => i.id)).toEqual([imageId]);
    const moves = await db.select().from(inventoryMovements).where(eq(inventoryMovements.variantId, m.id));
    expect(moves).toMatchObject([{ delta: 4, reason: "receipt" }]);
    const audit = await db.select().from(auditLogs).where(eq(auditLogs.entityId, productId));
    expect(audit.map((a) => a.action)).toContain("product.create");
    // drafts never reach the shop
    expect(await getProductBySlug(db, `shell-jacket-${T}`)).toBeNull();
  });

  it("rejects bad input with a readable message", async () => {
    const r1 = await runAdmin(() => saveProduct(db, manager, base({ slug: "Bad Slug!" })), "ok");
    expect(r1).toMatchObject({ ok: false });
    expect(r1.message).toMatch(/Web address/);
    const r2 = await runAdmin(
      () => saveProduct(db, manager, base({ slug: `x-${T}`, variants: [{ sku: `DUP-${T}`, usd: "10", stock: 0 }, { sku: `DUP-${T}`, usd: "10", stock: 0 }] })),
      "ok",
    );
    expect(r2.message).toMatch(/appears twice/);
    const r3 = await runAdmin(() => saveProduct(db, manager, base({ slug: `y-${T}`, variants: [{ sku: `P-${T}`, usd: "12,34,5", stock: 0 }] })), "ok");
    expect(r3.message).toMatch(/USD price must be a number/);
    const r4 = await runAdmin(() => saveProduct(db, manager, base({ slug: `z-${T}`, variants: [{ sku: `C-${T}`, usd: "100", usdCompare: "90", stock: 0 }] })), "ok");
    expect(r4.message).toMatch(/compare-at price must be higher/);
  });

  it("will not publish without a USD price", async () => {
    const r = await runAdmin(
      () => saveProduct(db, manager, base({ slug: `nop-${T}`, status: "published", variants: [{ sku: `NOP-${T}`, brl: "100", stock: 1 }] })),
      "ok",
    );
    expect(r).toMatchObject({ ok: false });
    expect(r.message).toMatch(/USD price/);
  });

  it("a taken slug or SKU gives a clear message", async () => {
    const r = await runAdmin(() => saveProduct(db, manager, base({ name: "Other" })), "ok");
    expect(r.message).toMatch(/already in use/);
  });

  it("publishes, and the product shows in the shop with its price and stock", async () => {
    const p = await getProductForEditor(db, manager, productId);
    await saveProduct(db, manager, {
      ...base({ imageIds: [imageId] }),
      id: productId,
      expectedUpdatedAt: p!.updatedAt,
      status: "published",
      variants: p!.variants.map((v) => ({ id: v.id, sku: v.sku, size: v.size, color: v.color, colorHex: v.colorHex, usd: "189.00", stock: v.onHand, stockWas: v.onHand })),
    });
    const live = await getProductBySlug(db, `shell-jacket-${T}`);
    expect(live?.variants.find((v) => v.size === "M")).toMatchObject({ priceMinor: 18900, available: 4 });
    const list = await listProducts(db, shopFilterSchema.parse({ q: T }));
    expect(list.items.map((i) => i.slug)).toContain(`shell-jacket-${T}`);
  });

  it("applies stock as a difference, so a sale made while the editor was open is not overwritten", async () => {
    const p = await getProductForEditor(db, manager, productId);
    const m = p!.variants.find((v) => v.size === "M")!;
    // a sale happens elsewhere after the editor loaded (4 → 3)
    await db.update(inventoryLevels).set({ onHand: 3 }).where(eq(inventoryLevels.variantId, m.id));
    // the person adds 2 units in the editor (4 → 6 on screen)
    await saveProduct(db, manager, {
      ...base(),
      id: productId,
      status: "published",
      imageIds: [imageId],
      variants: p!.variants.map((v) => ({ id: v.id, sku: v.sku, size: v.size, color: v.color, usd: "189", stock: v.id === m.id ? 6 : v.onHand, stockWas: v.onHand })),
    });
    const [level] = await db.select().from(inventoryLevels).where(eq(inventoryLevels.variantId, m.id));
    expect(level.onHand).toBe(5); // 3 + 2, not 6
  });

  it("refuses to save over someone else's newer changes", async () => {
    const r = await runAdmin(
      () => saveProduct(db, manager, { ...base(), id: productId, expectedUpdatedAt: new Date(2000, 1, 1).toISOString(), variants: [] }),
      "ok",
    );
    expect(r.message).toMatch(/Someone else saved/);
  });

  it("removing a variant with past orders hides it instead of deleting it", async () => {
    const p = await getProductForEditor(db, manager, productId);
    const l = p!.variants.find((v) => v.size === "L")!;
    const merchant = await makeMerchant(db);
    const order = await makeOrder(db, { userId: null, merchantId: merchant.id });
    await db.insert(orderItems).values({ orderId: order.id, variantId: l.id, productName: "x", sku: l.sku, unitPriceMinor: 18900, quantity: 1 });
    const res = await saveProduct(db, manager, {
      ...base({ imageIds: [imageId] }),
      id: productId,
      status: "published",
      variants: p!.variants.filter((v) => v.id !== l.id).map((v) => ({ id: v.id, sku: v.sku, size: v.size, color: v.color, usd: "189", stock: v.onHand, stockWas: v.onHand })),
    });
    expect(res.notes.join(" ")).toMatch(/hidden instead of deleted/);
    const [row] = await db.select().from(productVariants).where(eq(productVariants.id, l.id));
    expect(row.isActive).toBe(false);
    // and a product with orders cannot be deleted
    const del = await runAdmin(() => deleteProduct(db, manager, productId), "ok");
    expect(del.message).toMatch(/cannot be deleted/);
  });

  it("duplicates as a draft with new SKUs and zero stock, and deletes a never-sold product", async () => {
    const { id } = await duplicateProduct(db, manager, productId);
    const copy = await getProductForEditor(db, manager, id);
    expect(copy).toMatchObject({ status: "draft", slug: `shell-jacket-${T}-copy` });
    expect(copy!.variants.every((v) => v.sku.endsWith("-COPY") && v.onHand === 0)).toBe(true);
    expect(copy!.images.map((i) => i.id)).toEqual([imageId]);
    await deleteProduct(db, manager, id);
    expect(await db.select().from(products).where(eq(products.id, id))).toHaveLength(0);
    expect(await db.select().from(variantPrices).where(eq(variantPrices.variantId, copy!.variants[0].id))).toHaveLength(0);
  });

  it("lists products with stock, price range and missing-price warnings", async () => {
    const list = await listAdminProducts(db, manager, { q: T });
    const row = list.items.find((i) => i.id === productId)!;
    expect(row).toMatchObject({ status: "published", minUsd: 18900, variants: 1, missingPrice: false });
    expect(row.image?.id).toBe(imageId);
  });
});

describe("inventory", () => {
  it("adjusts with a reason, keeps history and never goes below reserved units", async () => {
    const [v] = await db.insert(productVariants).values({ productId: (await saveProduct(db, manager, base({ slug: `inv-${T}`, name: "Inv", variants: [{ sku: `INV-${T}`, usd: "10", stock: 2 }] }))).id, sku: `INV2-${T}` }).returning();
    await expect(adjustStock(db, editor, { variantId: v.id, delta: 5, reason: "receipt" })).rejects.toBeInstanceOf(AccessDeniedError);
    expect(await adjustStock(db, manager, { variantId: v.id, delta: 5, reason: "receipt", note: "Batch 7" })).toMatchObject({ onHand: 5 });
    await db.update(inventoryLevels).set({ reserved: 3 }).where(eq(inventoryLevels.variantId, v.id));
    const r = await runAdmin(() => adjustStock(db, manager, { variantId: v.id, delta: -4, reason: "damage" }), "ok");
    expect(r.message).toMatch(/reserved/);
    expect(await adjustStock(db, manager, { variantId: v.id, delta: -2, reason: "damage" })).toMatchObject({ onHand: 3 });
    const moves = await listMovements(db, manager, v.id);
    expect(moves.map((m) => [m.delta, m.reason])).toEqual([[-2, "damage"], [5, "receipt"]]);
    const low = await listInventory(db, manager, { q: `INV2-${T}`, view: "out" });
    expect(low.items.map((i) => i.sku)).toEqual([`INV2-${T}`]); // 3 on hand, 3 reserved
  });
});

describe("collections and categories", () => {
  it("creates a collection with ordered products and publishes it", async () => {
    const cat = await saveCategory(db, manager, { name: "Outerwear", slug: `outer-${T}` });
    expect(cat.slug).toBe(`outer-${T}`);
    const a = await saveProduct(db, manager, base({ slug: `ca-${T}`, name: "Alpha", status: "published", variants: [{ sku: `CA-${T}`, usd: "10", stock: 1 }] }));
    const b = await saveProduct(db, manager, base({ slug: `cb-${T}`, name: "Bravo", status: "published", variants: [{ sku: `CB-${T}`, usd: "10", stock: 1 }] }));
    await expect(saveCollection(db, editor, { name: "Drop", slug: `drop-${T}`, status: "draft" })).rejects.toBeInstanceOf(AccessDeniedError);
    const { id } = await saveCollection(db, manager, { name: "Drop 01", slug: `drop-${T}`, status: "draft", heroImageId: imageId, productIds: [b.id, a.id] });
    expect(await getCollectionBySlug(db, `drop-${T}`)).toBeNull(); // draft
    await saveCollection(db, manager, { id, name: "Drop 01", slug: `drop-${T}`, status: "published", heroImageId: imageId, productIds: [b.id, a.id] });
    expect((await getCollectionBySlug(db, `drop-${T}`))?.image?.id).toBe(imageId);
    expect((await getCollectionForEditor(db, manager, id))?.productIds).toEqual([b.id, a.id]);
    const page = await listProducts(db, shopFilterSchema.parse({ collection: `drop-${T}` }));
    expect(page.items.map((i) => i.id)).toEqual([b.id, a.id]); // collection order is respected
    await deleteCollection(db, manager, id);
    expect(await db.select().from(products).where(eq(products.id, a.id))).toHaveLength(1); // products stay
  });
});
