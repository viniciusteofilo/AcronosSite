import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  char,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./auth";

/*
 * Money is always an integer amount in minor units (cents) plus an ISO 4217 currency code.
 * Never floating point.
 */

const timestamps = {
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
};

// ---------------------------------------------------------------- legal entity & payment accounts
// Launch: the Brazilian company (CNPJ). Later: a US company. Each order records which one sold it.

export const merchantEntities = pgTable("merchant_entities", {
  id: uuid().primaryKey().defaultRandom(),
  legalName: text().notNull(),
  country: char({ length: 2 }).notNull(),
  taxId: text(),
  settlementCurrency: char({ length: 3 }).notNull(),
  isActive: boolean().notNull().default(false),
  ...timestamps,
});

export const PAYMENT_PROVIDERS = ["stripe", "paypal"] as const;
export const PAYMENT_ENVIRONMENTS = ["sandbox", "live"] as const;

/** Only identifiers live here. Secret keys stay in environment variables, never in the database. */
export const paymentAccounts = pgTable(
  "payment_accounts",
  {
    id: uuid().primaryKey().defaultRandom(),
    merchantEntityId: uuid()
      .notNull()
      .references(() => merchantEntities.id),
    provider: text({ enum: PAYMENT_PROVIDERS }).notNull(),
    environment: text({ enum: PAYMENT_ENVIRONMENTS }).notNull(),
    externalAccountId: text(),
    isActive: boolean().notNull().default(false),
    ...timestamps,
  },
  (t) => [unique().on(t.merchantEntityId, t.provider, t.environment)],
);

// ---------------------------------------------------------------- catalog

export const PUBLISH_STATUS = ["draft", "published", "archived"] as const;

export const categories = pgTable("categories", {
  id: uuid().primaryKey().defaultRandom(),
  slug: text().notNull().unique(),
  name: text().notNull(),
  parentId: uuid(),
  sortOrder: integer().notNull().default(0),
  ...timestamps,
});

export const collections = pgTable("collections", {
  id: uuid().primaryKey().defaultRandom(),
  slug: text().notNull().unique(),
  name: text().notNull(),
  description: text(),
  heroImageId: uuid(),
  status: text({ enum: PUBLISH_STATUS }).notNull().default("draft"),
  seoTitle: text(),
  seoDescription: text(),
  ...timestamps,
});

export const products = pgTable(
  "products",
  {
    id: uuid().primaryKey().defaultRandom(),
    slug: text().notNull().unique(),
    name: text().notNull(),
    description: text(),
    composition: text(),
    care: text(),
    technicalInfo: text(),
    categoryId: uuid().references(() => categories.id, { onDelete: "set null" }),
    status: text({ enum: PUBLISH_STATUS }).notNull().default("draft"),
    publishedAt: timestamp({ withTimezone: true }),
    seoTitle: text(),
    seoDescription: text(),
    ...timestamps,
  },
  (t) => [index().on(t.status)],
);

export const productVariants = pgTable(
  "product_variants",
  {
    id: uuid().primaryKey().defaultRandom(),
    productId: uuid()
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    sku: text().notNull().unique(),
    size: text(),
    color: text(),
    colorHex: char({ length: 7 }), // swatch shown to customers, e.g. #1A1A1A
    weightGrams: integer(),
    lengthMm: integer(),
    widthMm: integer(),
    heightMm: integer(),
    hsCode: text(), // customs classification for exports (BLOCKED until defined with a broker)
    isActive: boolean().notNull().default(true),
    ...timestamps,
  },
  (t) => [
    index().on(t.productId),
    check("variant_weight_positive", sql`${t.weightGrams} IS NULL OR ${t.weightGrams} > 0`),
  ],
);

/** Fixed price lists per currency (USD for the US, BRL for Brazil and as the base for Stripe Adaptive Pricing). */
export const variantPrices = pgTable(
  "variant_prices",
  {
    variantId: uuid()
      .notNull()
      .references(() => productVariants.id, { onDelete: "cascade" }),
    currency: char({ length: 3 }).notNull(),
    amountMinor: integer().notNull(),
    compareAtMinor: integer(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.variantId, t.currency] }),
    check("price_non_negative", sql`${t.amountMinor} >= 0`),
  ],
);

export type MediaRendition = { key: string; width: number; height: number; bytes: number };

/** One uploaded image. `renditions` holds the resized WebP files (e.g. 640/1280/2400 px wide). */
export const mediaAssets = pgTable("media_assets", {
  id: uuid().primaryKey().defaultRandom(),
  storageKey: text().notNull().unique(),
  contentType: text().notNull(),
  byteSize: integer().notNull(),
  width: integer(),
  height: integer(),
  renditions: jsonb().$type<MediaRendition[]>().notNull().default([]),
  originalName: text(),
  /** Point of interest (0–1) kept in view when the image is cropped to different shapes. */
  focalX: numeric({ precision: 4, scale: 3 }).notNull().default("0.5"),
  focalY: numeric({ precision: 4, scale: 3 }).notNull().default("0.5"),
  altText: text(),
  uploadedBy: uuid().references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const productImages = pgTable(
  "product_images",
  {
    productId: uuid()
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    mediaAssetId: uuid()
      .notNull()
      .references(() => mediaAssets.id, { onDelete: "cascade" }),
    variantId: uuid().references(() => productVariants.id, { onDelete: "set null" }),
    sortOrder: integer().notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.productId, t.mediaAssetId] })],
);

export const productCollections = pgTable(
  "product_collections",
  {
    productId: uuid()
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    collectionId: uuid()
      .notNull()
      .references(() => collections.id, { onDelete: "cascade" }),
    sortOrder: integer().notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.productId, t.collectionId] })],
);

// ---------------------------------------------------------------- inventory

export const inventoryLevels = pgTable(
  "inventory_levels",
  {
    variantId: uuid()
      .primaryKey()
      .references(() => productVariants.id, { onDelete: "cascade" }),
    onHand: integer().notNull().default(0),
    reserved: integer().notNull().default(0),
    lowStockThreshold: integer().notNull().default(2),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // The database itself refuses to oversell: reserved stock can never exceed stock on hand.
    check("inventory_on_hand_non_negative", sql`${t.onHand} >= 0`),
    check("inventory_reserved_non_negative", sql`${t.reserved} >= 0`),
    check("inventory_reserved_within_on_hand", sql`${t.reserved} <= ${t.onHand}`),
  ],
);

export const INVENTORY_REASONS = [
  "receipt",
  "manual_adjustment",
  "sale",
  "return",
  "damage",
  "count_correction",
] as const;

export const inventoryMovements = pgTable(
  "inventory_movements",
  {
    id: uuid().primaryKey().defaultRandom(),
    variantId: uuid()
      .notNull()
      .references(() => productVariants.id, { onDelete: "cascade" }),
    delta: integer().notNull(),
    reason: text({ enum: INVENTORY_REASONS }).notNull(),
    note: text(),
    orderId: uuid(),
    actorId: uuid().references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index().on(t.variantId, t.createdAt)],
);

export const inventoryReservations = pgTable(
  "inventory_reservations",
  {
    id: uuid().primaryKey().defaultRandom(),
    variantId: uuid()
      .notNull()
      .references(() => productVariants.id, { onDelete: "cascade" }),
    orderId: uuid().notNull(),
    quantity: integer().notNull(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    releasedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index().on(t.expiresAt),
    unique().on(t.orderId, t.variantId),
    check("reservation_quantity_positive", sql`${t.quantity} > 0`),
  ],
);

// ---------------------------------------------------------------- customers, carts, orders

export const addresses = pgTable("addresses", {
  id: uuid().primaryKey().defaultRandom(),
  userId: uuid().references(() => users.id, { onDelete: "cascade" }),
  fullName: text().notNull(),
  line1: text().notNull(),
  line2: text(),
  city: text().notNull(),
  region: text(),
  postalCode: text().notNull(),
  country: char({ length: 2 }).notNull(),
  phone: text(),
  ...timestamps,
});

export const carts = pgTable("carts", {
  id: uuid().primaryKey().defaultRandom(),
  userId: uuid().references(() => users.id, { onDelete: "cascade" }),
  currency: char({ length: 3 }).notNull(),
  ...timestamps,
});

export const cartItems = pgTable(
  "cart_items",
  {
    cartId: uuid()
      .notNull()
      .references(() => carts.id, { onDelete: "cascade" }),
    variantId: uuid()
      .notNull()
      .references(() => productVariants.id, { onDelete: "cascade" }),
    quantity: integer().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.cartId, t.variantId] }),
    check("cart_quantity_range", sql`${t.quantity} BETWEEN 1 AND 20`),
  ],
);

export const PAYMENT_STATUS = [
  "pending",
  "authorized",
  "paid",
  "partially_refunded",
  "refunded",
  "failed",
  "canceled",
] as const;
export const PROCESSING_STATUS = ["new", "processing", "ready", "completed", "canceled"] as const;
export const FULFILLMENT_STATUS = [
  "unfulfilled",
  "partially_shipped",
  "shipped",
  "delivered",
  "returned",
] as const;

export const orders = pgTable(
  "orders",
  {
    id: uuid().primaryKey().defaultRandom(),
    number: text().notNull().unique(),
    userId: uuid().references(() => users.id, { onDelete: "set null" }),
    email: text().notNull(),
    merchantEntityId: uuid()
      .notNull()
      .references(() => merchantEntities.id),
    currency: char({ length: 3 }).notNull(),
    subtotalMinor: integer().notNull(),
    discountMinor: integer().notNull().default(0),
    shippingMinor: integer().notNull().default(0),
    taxMinor: integer().notNull().default(0),
    dutiesMinor: integer().notNull().default(0),
    totalMinor: integer().notNull(),
    paymentStatus: text({ enum: PAYMENT_STATUS }).notNull().default("pending"),
    processingStatus: text({ enum: PROCESSING_STATUS }).notNull().default("new"),
    fulfillmentStatus: text({ enum: FULFILLMENT_STATUS }).notNull().default("unfulfilled"),
    shippingAddress: jsonb(),
    /** Snapshot of the chosen shipping method (name, carrier, price, duties model). */
    shippingMethod: jsonb(),
    country: char({ length: 2 }),
    idempotencyKey: text().notNull().unique(),
    paymentProvider: text({ enum: PAYMENT_PROVIDERS }),
    /** Stripe Checkout Session id or PayPal order id. */
    providerCheckoutId: text().unique(),
    checkoutUrl: text(),
    /** Secret in the confirmation link, so only the buyer can see the order status page. */
    publicToken: text(),
    /** Set when something needs a person to look (e.g. paid after the reservation expired and stock ran out). */
    needsAttention: text(),
    paidAt: timestamp({ withTimezone: true }),
    canceledAt: timestamp({ withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index().on(t.userId),
    index().on(t.createdAt),
    check(
      "order_total_consistent",
      sql`${t.totalMinor} = ${t.subtotalMinor} - ${t.discountMinor} + ${t.shippingMinor} + ${t.taxMinor} + ${t.dutiesMinor}`,
    ),
  ],
);

export const orderItems = pgTable("order_items", {
  id: uuid().primaryKey().defaultRandom(),
  orderId: uuid()
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  variantId: uuid().references(() => productVariants.id, { onDelete: "set null" }),
  // Snapshot at purchase time: later catalog edits never change past orders.
  productName: text().notNull(),
  sku: text().notNull(),
  size: text(),
  color: text(),
  unitPriceMinor: integer().notNull(),
  quantity: integer().notNull(),
});

export const payments = pgTable(
  "payments",
  {
    id: uuid().primaryKey().defaultRandom(),
    orderId: uuid()
      .notNull()
      .references(() => orders.id),
    paymentAccountId: uuid().references(() => paymentAccounts.id),
    provider: text({ enum: PAYMENT_PROVIDERS }).notNull(),
    providerPaymentId: text(),
    chargedCurrency: char({ length: 3 }).notNull(),
    chargedAmountMinor: integer().notNull(),
    settledCurrency: char({ length: 3 }),
    settledAmountMinor: integer(),
    feeMinor: integer(),
    status: text({ enum: PAYMENT_STATUS }).notNull().default("pending"),
    ...timestamps,
  },
  (t) => [uniqueIndex().on(t.provider, t.providerPaymentId)],
);

/** Every webhook event processed once: the unique index makes replays harmless (idempotency). */
export const paymentEvents = pgTable(
  "payment_events",
  {
    id: uuid().primaryKey().defaultRandom(),
    provider: text({ enum: PAYMENT_PROVIDERS }).notNull(),
    providerEventId: text().notNull(),
    type: text().notNull(),
    paymentId: uuid().references(() => payments.id),
    payload: jsonb().notNull(),
    receivedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp({ withTimezone: true }),
  },
  (t) => [uniqueIndex().on(t.provider, t.providerEventId)],
);

export const refunds = pgTable("refunds", {
  id: uuid().primaryKey().defaultRandom(),
  paymentId: uuid()
    .notNull()
    .references(() => payments.id),
  providerRefundId: text().unique(),
  amountMinor: integer().notNull(),
  reason: text(),
  status: text({ enum: ["pending", "succeeded", "failed"] }).notNull().default("pending"),
  requestedBy: uuid().references(() => users.id, { onDelete: "set null" }),
  ...timestamps,
});

export const coupons = pgTable("coupons", {
  id: uuid().primaryKey().defaultRandom(),
  code: text().notNull().unique(),
  kind: text({ enum: ["percent", "fixed"] }).notNull(),
  value: integer().notNull(),
  currency: char({ length: 3 }),
  startsAt: timestamp({ withTimezone: true }),
  endsAt: timestamp({ withTimezone: true }),
  maxRedemptions: integer(),
  isActive: boolean().notNull().default(false),
  ...timestamps,
});

export const couponRedemptions = pgTable(
  "coupon_redemptions",
  {
    couponId: uuid()
      .notNull()
      .references(() => coupons.id),
    orderId: uuid()
      .notNull()
      .references(() => orders.id),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.couponId, t.orderId] })],
);

// ---------------------------------------------------------------- shipping & currency

export const shippingZones = pgTable("shipping_zones", {
  id: uuid().primaryKey().defaultRandom(),
  name: text().notNull(),
  countries: char({ length: 2 }).array().notNull(),
  // A zone sells only after freight, duties and taxes are validated (protocol section 22).
  isEnabled: boolean().notNull().default(false),
  ...timestamps,
});

export const shippingMethods = pgTable("shipping_methods", {
  id: uuid().primaryKey().defaultRandom(),
  zoneId: uuid()
    .notNull()
    .references(() => shippingZones.id, { onDelete: "cascade" }),
  name: text().notNull(),
  carrier: text(),
  currency: char({ length: 3 }).notNull(),
  priceMinor: integer().notNull(),
  freeOverMinor: integer(),
  dutiesModel: text({ enum: ["ddp", "ddu", "domestic"] }).notNull(),
  isActive: boolean().notNull().default(false),
  ...timestamps,
});

export const shipments = pgTable("shipments", {
  id: uuid().primaryKey().defaultRandom(),
  orderId: uuid()
    .notNull()
    .references(() => orders.id),
  carrier: text(),
  trackingNumber: text(),
  trackingUrl: text(),
  shippedAt: timestamp({ withTimezone: true }),
  deliveredAt: timestamp({ withTimezone: true }),
  ...timestamps,
});

/** Daily rates used only to show estimated prices; the checkout amount always comes from the provider. */
export const exchangeRates = pgTable(
  "exchange_rates",
  {
    base: char({ length: 3 }).notNull(),
    quote: char({ length: 3 }).notNull(),
    rate: numeric({ precision: 18, scale: 8 }).notNull(),
    rateDate: date().notNull(),
    source: text().notNull(),
  },
  (t) => [primaryKey({ columns: [t.base, t.quote, t.rateDate] })],
);

/**
 * A short campaign film cut into still frames (WebP) that play as the visitor scrolls.
 * Frames live in storage under seq/<id>/d/NNNN.webp (desktop) and seq/<id>/m/NNNN.webp (phones).
 */
export const scrollSequences = pgTable("scroll_sequences", {
  id: uuid().primaryKey().defaultRandom(),
  frameCount: integer().notNull(),
  width: integer().notNull(),
  height: integer().notNull(),
  mobileWidth: integer().notNull(),
  mobileHeight: integer().notNull(),
  originalName: text(),
  status: text({ enum: ["uploading", "ready"] }).notNull().default("uploading"),
  totalBytes: integer().notNull().default(0),
  createdBy: uuid().references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});
