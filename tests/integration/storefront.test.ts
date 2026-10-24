import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import {
  categories,
  collections,
  contentRevisions,
  inventoryLevels,
  newsletterSubscribers,
  pages,
  productCollections,
  products,
  productVariants,
  stories,
  variantPrices,
} from "@/db/schema";
import { getCollectionBySlug, getProductBySlug, getShopFacets, listCollections, listProducts, parseShopFilters, shopFilterSchema } from "@/server/catalog/queries";
import { getLiveHome, getHomeEditorState, HOME_DEFAULTS, homeBlocksSchema, normalizeHome, publishHome, saveHomeDraft, scheduleHome } from "@/server/content/home";
import { getStoryBySlug, listStories, sanitizeStoryHtml } from "@/server/content/stories";
import { createMediaAsset, UploadError } from "@/server/media/library";
import { readWebpSize } from "@/server/media/webp";
import { subscribeNewsletter } from "@/server/marketing/forms";
import { AccessDeniedError } from "@/server/rbac/access";
import { takeRateLimit } from "@/server/security/rate-limit";
import { ctxFor, makeUser, testDb } from "../helpers";

const { db, client } = testDb();
afterAll(() => client.end());

const T = `t${Date.now().toString(36)}`; // unique token so assertions ignore rows from other tests
const past = new Date(Date.now() - 86_400_000);
const future = new Date(Date.now() + 86_400_000);

async function product(opts: {
  slug: string;
  name: string;
  status?: "draft" | "published" | "archived";
  publishedAt?: Date | null;
  categoryId?: string;
  variants: { sku: string; size?: string; color?: string; hex?: string; usd?: number | null; onHand?: number }[];
}) {
  const [p] = await db
    .insert(products)
    .values({ slug: opts.slug, name: opts.name, status: opts.status ?? "published", publishedAt: opts.publishedAt ?? past, categoryId: opts.categoryId })
    .returning();
  for (const v of opts.variants) {
    const [row] = await db.insert(productVariants).values({ productId: p.id, sku: v.sku, size: v.size, color: v.color, colorHex: v.hex }).returning();
    if (v.usd !== null) await db.insert(variantPrices).values({ variantId: row.id, currency: "USD", amountMinor: v.usd ?? 10_000 });
    await db.insert(inventoryLevels).values({ variantId: row.id, onHand: v.onHand ?? 5 });
  }
  return p;
}

let catId: string;
beforeAll(async () => {
  const [cat] = await db.insert(categories).values({ slug: `outerwear-${T}`, name: "Outerwear" }).returning();
  catId = cat.id;
  await product({
    slug: `jacket-${T}`,
    name: `Shell jacket ${T}`,
    categoryId: catId,
    variants: [
      { sku: `JK-${T}-S`, size: "S", color: "Graphite", hex: "#1a1a1a", usd: 18_900, onHand: 0 },
      { sku: `JK-${T}-M`, size: "M", color: "Graphite", hex: "#1a1a1a", usd: 18_900, onHand: 3 },
    ],
  });
  await product({ slug: `tee-${T}`, name: `Tee ${T}`, variants: [{ sku: `TS-${T}-M`, size: "M", color: "Bone", hex: "#e6e2da", usd: 5_900, onHand: 0 }] });
  await product({ slug: `draft-${T}`, name: `Draft ${T}`, status: "draft", variants: [{ sku: `DR-${T}`, usd: 1_000 }] });
  await product({ slug: `future-${T}`, name: `Future ${T}`, publishedAt: future, variants: [{ sku: `FU-${T}`, usd: 1_000 }] });
  await product({ slug: `noprice-${T}`, name: `No price ${T}`, variants: [{ sku: `NP-${T}`, usd: null }] });
});

describe("catalog: only what is published and sellable is shown", () => {
  it("lists published products with a USD price, hides drafts, future and unpriced ones", async () => {
    const { items, total } = await listProducts(db, shopFilterSchema.parse({ q: T }));
    expect(items.map((i) => i.slug).sort()).toEqual([`jacket-${T}`, `tee-${T}`]);
    expect(total).toBe(2);
  });

  it("computes price, availability and swatches per product", async () => {
    const { items } = await listProducts(db, shopFilterSchema.parse({ q: `Shell jacket ${T}` }));
    expect(items[0]).toMatchObject({ priceMinor: 18_900, available: 3, colors: ["#1a1a1a"] });
  });

  it("filters by size, color, category, price range and stock; sorts by price", async () => {
    const q = T;
    const slugs = async (f: Record<string, unknown>) => (await listProducts(db, shopFilterSchema.parse({ q, ...f }))).items.map((i) => i.slug);
    expect(await slugs({ size: ["S"] })).toEqual([`jacket-${T}`]);
    expect(await slugs({ color: ["Bone"] })).toEqual([`tee-${T}`]);
    expect(await slugs({ category: `outerwear-${T}` })).toEqual([`jacket-${T}`]);
    expect(await slugs({ max: 100 })).toEqual([`tee-${T}`]);
    expect(await slugs({ min: 100 })).toEqual([`jacket-${T}`]);
    expect(await slugs({ inStock: true })).toEqual([`jacket-${T}`]);
    expect(await slugs({ sort: "price_asc" })).toEqual([`tee-${T}`, `jacket-${T}`]);
    // a size that is sold out for that color does not count as "in stock"
    expect(await slugs({ size: ["S"], inStock: true })).toEqual([]);
  });

  it("treats search text literally (no SQL wildcards or injection)", async () => {
    expect((await listProducts(db, shopFilterSchema.parse({ q: "%" }))).items.every((i) => i.name.includes("%"))).toBe(true);
    expect((await listProducts(db, shopFilterSchema.parse({ q: "'; DROP TABLE products; --" }))).total).toBe(0);
  });

  it("parses URL filters and drops invalid ones", () => {
    const f = parseShopFilters({ size: ["S", "M"], color: "Bone", min: "abc", sort: "evil", stock: "1", page: "-3" });
    expect(f.size).toEqual([]); // whole parse falls back to defaults when anything is invalid
    const g = parseShopFilters({ size: ["S", "M"], color: "Bone", stock: "1" });
    expect(g).toMatchObject({ size: ["S", "M"], color: ["Bone"], inStock: true, sort: "newest", page: 1 });
  });

  it("returns product detail only when visible, with all sellable variants", async () => {
    const p = await getProductBySlug(db, `jacket-${T}`);
    expect(p?.variants.map((v) => [v.size, v.available])).toEqual([["M", 3], ["S", 0]]);
    expect(await getProductBySlug(db, `draft-${T}`)).toBeNull();
    expect(await getProductBySlug(db, `future-${T}`)).toBeNull();
    expect(await getProductBySlug(db, `noprice-${T}`)).toBeNull();
  });

  it("offers filter values that exist in the published catalog only", async () => {
    const f = await getShopFacets(db);
    expect(f.categories.some((c) => c.slug === `outerwear-${T}`)).toBe(true);
    expect(f.sizes).toEqual(expect.arrayContaining(["S", "M"]));
  });

  it("lists published collections with their product count", async () => {
    const [c] = await db.insert(collections).values({ slug: `drop-${T}`, name: "Drop", status: "published" }).returning();
    await db.insert(collections).values({ slug: `hidden-${T}`, name: "Hidden", status: "draft" });
    const [jacket] = await db.select().from(products).where(eq(products.slug, `jacket-${T}`));
    await db.insert(productCollections).values({ productId: jacket.id, collectionId: c.id });
    const list = await listCollections(db);
    expect(list.find((x) => x.slug === `drop-${T}`)?.productCount).toBe(1);
    expect(list.some((x) => x.slug === `hidden-${T}`)).toBe(false);
    expect(await getCollectionBySlug(db, `hidden-${T}`)).toBeNull();
    expect((await listProducts(db, shopFilterSchema.parse({ collection: `drop-${T}` }))).items.map((i) => i.slug)).toEqual([`jacket-${T}`]);
  });
});

describe("stories", () => {
  it("shows published and due stories, hides drafts and future ones, and links neighbours", async () => {
    await db.insert(stories).values([
      { slug: `s1-${T}`, title: "One", authorName: "A", status: "published", publishedAt: new Date(Date.now() - 3 * 86_400_000), body: "<p>One</p>" },
      { slug: `s2-${T}`, title: "Two", authorName: "A", status: "published", publishedAt: new Date(Date.now() - 2 * 86_400_000), body: "<p>Two</p>" },
      { slug: `s3-${T}`, title: "Draft", authorName: "A", status: "draft", body: "" },
      { slug: `s4-${T}`, title: "Later", authorName: "A", status: "scheduled", publishAt: future, body: "" },
    ]);
    const slugs = (await listStories(db)).map((s) => s.slug);
    expect(slugs).toEqual(expect.arrayContaining([`s1-${T}`, `s2-${T}`]));
    expect(slugs).not.toContain(`s3-${T}`);
    expect(slugs).not.toContain(`s4-${T}`);
    const two = await getStoryBySlug(db, `s2-${T}`);
    expect(two?.previous?.slug).toBe(`s1-${T}`);
    expect(await getStoryBySlug(db, `s4-${T}`)).toBeNull();
  });

  it("removes scripts, event handlers and unsafe links from story HTML", () => {
    const out = sanitizeStoryHtml(`<p onclick="x()">Hi<script>alert(1)</script></p><a href="javascript:alert(1)">x</a><img src=x onerror=alert(1)><a href="https://acronos.example">ok</a>`);
    expect(out).not.toMatch(/script|onclick|onerror|javascript:|<img/i);
    expect(out).toContain('href="https://acronos.example"');
    expect(out).toContain('rel="noopener noreferrer nofollow"');
  });
});

describe("homepage site editor", () => {
  it("merges stored content over defaults and rejects unsafe links", () => {
    expect(normalizeHome(null)).toEqual(HOME_DEFAULTS);
    expect(normalizeHome({ hero: { headline: "New" } }).hero.headline).toBe("New");
    const bad = structuredClone(HOME_DEFAULTS);
    bad.hero.primary.href = "javascript:alert(1)";
    expect(homeBlocksSchema.safeParse(bad).success).toBe(false);
    bad.hero.primary.href = "//evil.example";
    expect(homeBlocksSchema.safeParse(bad).success).toBe(false);
  });

  it("refuses edits from people without content permission", async () => {
    const om = await makeUser(db, { roles: ["order_manager"], twoFactorEnabled: true });
    await expect(saveHomeDraft(db, ctxFor(om, ["order_manager"]), HOME_DEFAULTS)).rejects.toBeInstanceOf(AccessDeniedError);
  });

  it("keeps drafts private until published, and records the previous version", async () => {
    const editor = await makeUser(db, { roles: ["content_editor"], twoFactorEnabled: true });
    const ctx = ctxFor(editor, ["content_editor"]);
    const draft = structuredClone(HOME_DEFAULTS);
    draft.hero.headline = `Campaign ${T}`;
    await getHomeEditorState(db, ctx); // creates the home row
    await saveHomeDraft(db, ctx, draft);
    expect((await getLiveHome(db)).blocks.hero.headline).not.toBe(`Campaign ${T}`);

    const [row] = await db.select().from(pages).where(eq(pages.slug, "home"));
    const before = await db.select().from(contentRevisions).where(eq(contentRevisions.entityId, row.id));
    await publishHome(db, ctx);
    expect((await getLiveHome(db)).blocks.hero.headline).toBe(`Campaign ${T}`);
    const after = await db.select().from(contentRevisions).where(eq(contentRevisions.entityId, row.id));
    expect(after.length).toBe(before.length + 1);
  });

  it("publishes a scheduled campaign automatically when its time comes", async () => {
    const editor = await makeUser(db, { roles: ["content_editor"], twoFactorEnabled: true });
    const ctx = ctxFor(editor, ["content_editor"]);
    const next = structuredClone(HOME_DEFAULTS);
    next.hero.headline = `Scheduled ${T}`;
    await saveHomeDraft(db, ctx, next);
    const at = new Date(Date.now() + 3_600_000);
    await scheduleHome(db, ctx, at.toISOString());
    expect((await getLiveHome(db)).blocks.hero.headline).not.toBe(`Scheduled ${T}`);
    expect((await getLiveHome(db, new Date(at.getTime() + 1000))).blocks.hero.headline).toBe(`Scheduled ${T}`);
  });

  it("does not schedule in the past", async () => {
    const editor = await makeUser(db, { roles: ["content_editor"], twoFactorEnabled: true });
    const ctx = ctxFor(editor, ["content_editor"]);
    await saveHomeDraft(db, ctx, HOME_DEFAULTS);
    await expect(scheduleHome(db, ctx, new Date(Date.now() - 1000).toISOString())).rejects.toThrow(/at least one minute/);
  });
});

describe("image uploads", () => {
  // 1×1 lossless WebP
  const tinyWebp = Uint8Array.from(Buffer.from("UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==", "base64"));

  it("reads real WebP dimensions and rejects anything else", () => {
    expect(readWebpSize(tinyWebp)).toEqual({ width: 1, height: 1 });
    expect(readWebpSize(new TextEncoder().encode("<svg onload=alert(1)>"))).toBeNull();
    const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, ...new Array(40).fill(0)]);
    expect(readWebpSize(png)).toBeNull();
  });

  /** Minimal extended-format (VP8X) WebP header declaring the given size. */
  const webpHeader = (w: number, h: number) => {
    const b = new Uint8Array(40);
    b.set(new TextEncoder().encode("RIFF"), 0);
    b.set(new TextEncoder().encode("WEBPVP8X"), 8);
    const put24 = (o: number, v: number) => b.set([v & 255, (v >> 8) & 255, (v >> 16) & 255], o);
    put24(24, w - 1);
    put24(27, h - 1);
    return b;
  };

  it("stores a WebP upload for editors and refuses fake, tiny or oversized images and non-editors", async () => {
    const editor = await makeUser(db, { roles: ["content_editor"], twoFactorEnabled: true });
    const ctx = ctxFor(editor, ["content_editor"]);
    const media = await createMediaAsset(db, ctx, { files: [webpHeader(640, 800), webpHeader(1280, 1600)], meta: { alt: "Test" } });
    expect(media.src).toMatch(/^\/media\/\d{4}\/\d{2}\/.+-1280\.webp$/);
    expect(media.srcSet).toContain("640w");
    await expect(createMediaAsset(db, ctx, { files: [tinyWebp], meta: {} })).rejects.toBeInstanceOf(UploadError);
    await expect(createMediaAsset(db, ctx, { files: [webpHeader(5000, 5000)], meta: {} })).rejects.toBeInstanceOf(UploadError);
    await expect(
      createMediaAsset(db, ctxFor(editor, ["content_editor"]), { files: [new TextEncoder().encode("not an image".padEnd(40))], meta: {} }),
    ).rejects.toBeInstanceOf(UploadError);
    const om = await makeUser(db, { roles: ["order_manager"], twoFactorEnabled: true });
    await expect(createMediaAsset(db, ctxFor(om, ["order_manager"]), { files: [tinyWebp], meta: {} })).rejects.toBeInstanceOf(AccessDeniedError);
  });
});

describe("newsletter and rate limits", () => {
  const form = (o: Record<string, string>) => {
    const f = new FormData();
    for (const [k, v] of Object.entries(o)) f.set(k, v);
    return f;
  };

  it("requires consent, records it, and answers the same for existing addresses", async () => {
    const email = `news-${T}@example.test`;
    expect((await subscribeNewsletter(db, form({ email }), `ip-a-${T}`)).ok).toBe(false);
    const first = await subscribeNewsletter(db, form({ email, consent: "on" }), `ip-a-${T}`);
    const again = await subscribeNewsletter(db, form({ email, consent: "on" }), `ip-a-${T}`);
    expect(first).toEqual(again);
    const [row] = await db.select().from(newsletterSubscribers).where(eq(newsletterSubscribers.email, email));
    expect(row).toMatchObject({ status: "pending", consentSource: "footer" });
    expect(row.consentAt).toBeInstanceOf(Date);
  });

  it("silently drops bot submissions (honeypot) without storing them", async () => {
    const email = `bot-${T}@example.test`;
    const r = await subscribeNewsletter(db, form({ email, consent: "on", website: "spam" }), `ip-b-${T}`);
    expect(r.ok).toBe(true);
    expect(await db.select().from(newsletterSubscribers).where(eq(newsletterSubscribers.email, email))).toHaveLength(0);
  });

  it("limits repeated attempts per visitor", async () => {
    const key = `test:${T}`;
    const results = [];
    for (let i = 0; i < 4; i++) results.push(await takeRateLimit(db, key, 3, 60));
    expect(results).toEqual([true, true, true, false]);
    expect(await takeRateLimit(db, key, 3, 60, Date.now() + 61_000)).toBe(true); // new window
  });
});
