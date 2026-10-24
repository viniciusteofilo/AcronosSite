import { and, asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "@/db/client";
import { merchantEntities, settings, shippingMethods, shippingZones } from "@/db/schema";
import { UserError, authorize } from "@/server/admin/errors";
import { recordAudit } from "@/server/audit/log";
import { paymentEnvStatus } from "@/server/payments";
import type { AccessContext } from "@/server/rbac/access";

/** Store switches kept in the settings table. Everything starts closed. */
export const storeSettingsSchema = z.object({
  checkoutOpen: z.boolean().default(false),
  merchantEntityId: z.uuid().nullable().default(null),
  stripeEnabled: z.boolean().default(false),
  paypalEnabled: z.boolean().default(false),
  /** Minutes a started checkout holds the stock (Stripe requires at least 30). */
  reservationMinutes: z.number().int().min(30).max(120).default(30),
});
export type StoreSettings = z.infer<typeof storeSettingsSchema>;

export async function getStoreSettings(db: Pick<Database, "select">): Promise<StoreSettings> {
  const [row] = await db.select({ value: settings.value }).from(settings).where(eq(settings.key, "store")).limit(1);
  const parsed = storeSettingsSchema.safeParse(row?.value ?? {});
  return parsed.success ? parsed.data : storeSettingsSchema.parse({});
}

export type CheckoutReadiness = {
  open: boolean;
  /** Reasons the store cannot take orders yet, in plain language. Empty when ready. */
  missing: string[];
  providers: ("stripe" | "paypal")[];
};

/** Can customers pay right now? Checks every condition, not just the switch. */
export async function getCheckoutReadiness(db: Database, s?: StoreSettings): Promise<CheckoutReadiness> {
  const st = s ?? (await getStoreSettings(db));
  const env = paymentEnvStatus();
  const missing: string[] = [];
  const [merchant] = st.merchantEntityId
    ? await db.select().from(merchantEntities).where(and(eq(merchantEntities.id, st.merchantEntityId), eq(merchantEntities.isActive, true))).limit(1)
    : [];
  if (!merchant) missing.push("Legal entity (the company that sells) is not set.");
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(shippingMethods)
    .innerJoin(shippingZones, eq(shippingZones.id, shippingMethods.zoneId))
    .where(and(eq(shippingZones.isEnabled, true), eq(shippingMethods.isActive, true)));
  if (n === 0) missing.push("No shipping zone with an active shipping method.");
  const providers = [
    ...(st.stripeEnabled && env.stripe.configured ? (["stripe"] as const) : []),
    ...(st.paypalEnabled && env.paypal.configured ? (["paypal"] as const) : []),
  ];
  if (providers.length === 0) missing.push("No payment method enabled with its keys configured.");
  if (!st.checkoutOpen) missing.push("Checkout switch is off.");
  return { open: missing.length === 0, missing, providers };
}

/** Patch: only the keys sent are changed (no defaults here, or they would overwrite saved values). */
const settingsInput = z.object({
  checkoutOpen: z.boolean().optional(),
  merchantEntityId: z.uuid().nullable().optional(),
  stripeEnabled: z.boolean().optional(),
  paypalEnabled: z.boolean().optional(),
  reservationMinutes: z.number().int().min(30).max(120).optional(),
});

export async function saveStoreSettings(db: Database, actor: AccessContext | null, raw: unknown) {
  const ctx = authorize(actor, "settings:manage");
  const patch = settingsInput.parse(raw);
  const current = await getStoreSettings(db);
  const next = storeSettingsSchema.parse({ ...current, ...Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)) });
  if (next.checkoutOpen && !current.checkoutOpen) {
    const ready = await getCheckoutReadiness(db, { ...next, checkoutOpen: true });
    if (!ready.open) throw new UserError(`The store cannot open yet: ${ready.missing.join(" ")}`);
  }
  await db.transaction(async (tx) => {
    await tx
      .insert(settings)
      .values({ key: "store", value: next, updatedBy: ctx.userId })
      .onConflictDoUpdate({ target: settings.key, set: { value: next, updatedBy: ctx.userId, updatedAt: new Date() } });
    await recordAudit(tx, { actorId: ctx.userId, action: "settings.store", entityType: "settings", before: current, after: next });
  });
  return next;
}

// ---------------------------------------------------------------- legal entity

const merchantInput = z.object({
  id: z.uuid().optional(),
  legalName: z.string().trim().min(2, "Legal name is required").max(200),
  country: z.string().trim().toUpperCase().length(2, "Country: two letters, e.g. BR"),
  taxId: z.string().trim().max(40).default(""),
  settlementCurrency: z.string().trim().toUpperCase().length(3, "Currency: three letters, e.g. BRL"),
});

export async function listMerchants(db: Database, actor: AccessContext | null) {
  authorize(actor, "settings:manage");
  return db.select().from(merchantEntities).orderBy(asc(merchantEntities.createdAt));
}

/** Saves the selling company and makes it the active one for new orders. */
export async function saveMerchant(db: Database, actor: AccessContext | null, raw: unknown) {
  const ctx = authorize(actor, "settings:manage");
  const input = merchantInput.parse(raw);
  return db.transaction(async (tx) => {
    const values = { legalName: input.legalName, country: input.country, taxId: input.taxId || null, settlementCurrency: input.settlementCurrency, isActive: true, updatedAt: new Date() };
    const [row] = input.id
      ? await tx.update(merchantEntities).set(values).where(eq(merchantEntities.id, input.id)).returning()
      : await tx.insert(merchantEntities).values(values).returning();
    if (!row) throw new UserError("Not found.");
    const current = await getStoreSettings(tx);
    const next = { ...current, merchantEntityId: row.id };
    await tx
      .insert(settings)
      .values({ key: "store", value: next, updatedBy: ctx.userId })
      .onConflictDoUpdate({ target: settings.key, set: { value: next, updatedBy: ctx.userId, updatedAt: new Date() } });
    await recordAudit(tx, { actorId: ctx.userId, action: "settings.merchant", entityType: "merchant_entity", entityId: row.id, after: { legalName: row.legalName, country: row.country } });
    return row;
  });
}

// ---------------------------------------------------------------- shipping

const countries = z
  .string()
  .transform((v) => [...new Set(v.toUpperCase().split(/[\s,;]+/).filter(Boolean))])
  .pipe(z.array(z.string().regex(/^[A-Z]{2}$/, "Countries: two-letter codes like US, BR, PT")).min(1, "Add at least one country").max(250));

const zoneInput = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(2, "Zone name is required").max(80),
  countries,
  isEnabled: z.boolean().default(false),
});

const methodInput = z.object({
  id: z.uuid().optional(),
  zoneId: z.uuid(),
  name: z.string().trim().min(2, "Method name is required").max(80),
  carrier: z.string().trim().max(80).default(""),
  currency: z.enum(["USD", "BRL"]),
  priceMinor: z.number().int().min(0).max(10_000_000),
  freeOverMinor: z.number().int().min(0).max(100_000_000).nullable().default(null),
  /** DDP needs duty calculation agreed with a customs broker: not available yet. */
  dutiesModel: z.enum(["ddu", "domestic"]),
  isActive: z.boolean().default(false),
});

export async function listShipping(db: Database, actor: AccessContext | null) {
  authorize(actor, "settings:manage");
  const [zones, methods] = await Promise.all([
    db.select().from(shippingZones).orderBy(asc(shippingZones.createdAt)),
    db.select().from(shippingMethods).orderBy(asc(shippingMethods.createdAt)),
  ]);
  return zones.map((z) => ({ ...z, methods: methods.filter((m) => m.zoneId === z.id) }));
}

export async function saveZone(db: Database, actor: AccessContext | null, raw: unknown) {
  const ctx = authorize(actor, "settings:manage");
  const input = zoneInput.parse(raw);
  // a country can belong to one enabled zone only, so the shipping options are never ambiguous
  if (input.isEnabled) {
    const others = await db.select().from(shippingZones).where(eq(shippingZones.isEnabled, true));
    const clash = others.filter((o) => o.id !== input.id).flatMap((o) => o.countries.filter((c) => input.countries.includes(c)).map((c) => `${c} (${o.name})`));
    if (clash.length) throw new UserError(`Already in another active zone: ${clash.join(", ")}.`);
  }
  const values = { name: input.name, countries: input.countries, isEnabled: input.isEnabled, updatedAt: new Date() };
  const [row] = input.id ? await db.update(shippingZones).set(values).where(eq(shippingZones.id, input.id)).returning() : await db.insert(shippingZones).values(values).returning();
  if (!row) throw new UserError("Zone not found.");
  await recordAudit(db, { actorId: ctx.userId, action: "settings.shipping_zone", entityType: "shipping_zone", entityId: row.id, after: values });
  return row;
}

export async function saveMethod(db: Database, actor: AccessContext | null, raw: unknown) {
  const ctx = authorize(actor, "settings:manage");
  const input = methodInput.parse(raw);
  const { id, ...rest } = input;
  const values = { ...rest, carrier: rest.carrier || null, updatedAt: new Date() };
  const [row] = id ? await db.update(shippingMethods).set(values).where(eq(shippingMethods.id, id)).returning() : await db.insert(shippingMethods).values(values).returning();
  if (!row) throw new UserError("Method not found.");
  await recordAudit(db, { actorId: ctx.userId, action: "settings.shipping_method", entityType: "shipping_method", entityId: row.id, after: values });
  return row;
}

export async function deleteShipping(db: Database, actor: AccessContext | null, kind: "zone" | "method", id: string) {
  const ctx = authorize(actor, "settings:manage");
  const t = kind === "zone" ? shippingZones : shippingMethods;
  const [row] = await db.delete(t).where(eq(t.id, z.uuid().parse(id))).returning({ id: t.id });
  if (!row) throw new UserError("Already deleted.");
  await recordAudit(db, { actorId: ctx.userId, action: `settings.shipping_${kind}.delete`, entityType: `shipping_${kind}`, entityId: id });
}

/** Countries customers can choose at checkout, with the methods available for each. */
export async function getShippingOptions(db: Database) {
  const rows = await db
    .select({ zone: shippingZones, method: shippingMethods })
    .from(shippingMethods)
    .innerJoin(shippingZones, eq(shippingZones.id, shippingMethods.zoneId))
    .where(and(eq(shippingZones.isEnabled, true), eq(shippingMethods.isActive, true)))
    .orderBy(asc(shippingMethods.priceMinor));
  const byCountry = new Map<string, { id: string; name: string; carrier: string | null; currency: string; priceMinor: number; freeOverMinor: number | null; dutiesModel: string }[]>();
  for (const r of rows) {
    for (const c of r.zone.countries) {
      const list = byCountry.get(c) ?? [];
      list.push({ id: r.method.id, name: r.method.name, carrier: r.method.carrier, currency: r.method.currency, priceMinor: r.method.priceMinor, freeOverMinor: r.method.freeOverMinor, dutiesModel: r.method.dutiesModel });
      byCountry.set(c, list);
    }
  }
  return byCountry;
}
