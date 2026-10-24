import { afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { accounts, addresses, newsletterSubscribers, orderItems, orders, privacyRequests, sessions, users } from "@/db/schema";
import { describeAgent, completeDeletion, endOtherSessions, exportMyData, listMySessions, requestAccountDeletion } from "@/server/account/self-service";
import { runAdmin } from "@/server/admin/errors";
import { resetTwoFactor } from "@/server/admin/people";
import { AccessDeniedError } from "@/server/rbac/access";
import { ordersCsv, resolvePeriod, salesReport } from "@/server/reports/sales";
import { ctxFor, makeMerchant, makeOrder, makeUser, testDb } from "../helpers";

const { db, client } = testDb();
afterAll(() => client.end());

describe("account self-service", () => {
  it("lists sessions and ends the other ones immediately", async () => {
    const u = await makeUser(db);
    const mk = (ua: string) =>
      db.insert(sessions).values({ userId: u.id, token: crypto.randomUUID(), expiresAt: new Date(Date.now() + 86_400_000), userAgent: ua, ipAddress: "203.0.113.5" }).returning();
    const [current] = await mk("Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit Chrome/140 Safari/537");
    await mk("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0) AppleWebKit Version/18 Mobile Safari/604");
    const ctx = { ...ctxFor(u, []), sessionId: current.id };
    const list = await listMySessions(db, ctx);
    expect(list).toHaveLength(2);
    expect(list.find((s) => s.current)?.device).toBe("Chrome on macOS");
    expect(await endOtherSessions(db, ctx)).toBe(1);
    expect(await db.select().from(sessions).where(eq(sessions.userId, u.id))).toHaveLength(1);
    expect(describeAgent(null)).toBe("Unknown device");
  });

  it("exports the person's own data and nothing secret", async () => {
    const u = await makeUser(db);
    await db.insert(accounts).values({ userId: u.id, accountId: u.id, providerId: "credential", password: "hash-secret" });
    await db.insert(addresses).values({ userId: u.id, fullName: "Me", line1: "1 St", city: "SP", postalCode: "01000", country: "BR" });
    const other = await makeUser(db);
    const m = await makeMerchant(db);
    await makeOrder(db, { userId: other.id, merchantId: m.id });
    const mine = await makeOrder(db, { userId: u.id, merchantId: m.id });
    await db.insert(orderItems).values({ orderId: mine.id, productName: "Tee", sku: "T-1", unitPriceMinor: 10_000, quantity: 1 });
    const data = await exportMyData(db, ctxFor(u, []));
    expect(data.account.email).toBe(u.email);
    expect(data.addresses).toHaveLength(1);
    expect(data.orders.map((o) => o.number)).toEqual([mine.number]);
    expect(data.orders[0].items[0].sku).toBe("T-1");
    expect(JSON.stringify(data)).not.toContain("hash-secret");
  });

  it("deletion: customer requests, privacy officer erases, orders are kept", async () => {
    const u = await makeUser(db);
    const m = await makeMerchant(db);
    const order = await makeOrder(db, { userId: u.id, merchantId: m.id });
    await db.insert(newsletterSubscribers).values({ email: u.email.toLowerCase(), status: "confirmed", consentSource: "footer" });
    await db.insert(sessions).values({ userId: u.id, token: crypto.randomUUID(), expiresAt: new Date(Date.now() + 86_400_000) });
    expect(await requestAccountDeletion(db, ctxFor(u, []))).toEqual({ alreadyRequested: false });
    expect(await requestAccountDeletion(db, ctxFor(u, []))).toEqual({ alreadyRequested: true });
    const [req] = await db.select().from(privacyRequests).where(eq(privacyRequests.userId, u.id));
    const manager = ctxFor(await makeUser(db, { roles: ["manager"], twoFactorEnabled: true }), ["manager"]);
    await expect(completeDeletion(db, manager, req.id)).rejects.toBeInstanceOf(AccessDeniedError);
    const owner = ctxFor(await makeUser(db, { roles: ["super_admin"], twoFactorEnabled: true }), ["super_admin"]);
    await completeDeletion(db, owner, req.id);
    const [after] = await db.select().from(users).where(eq(users.id, u.id));
    expect(after.email).toBe(`deleted-${u.id}@deleted.invalid`);
    expect(after.name).toBe("Deleted customer");
    expect(await db.select().from(sessions).where(eq(sessions.userId, u.id))).toHaveLength(0);
    expect(await db.select().from(newsletterSubscribers).where(eq(newsletterSubscribers.email, u.email.toLowerCase()))).toHaveLength(0);
    expect(await db.select().from(orders).where(eq(orders.id, order.id))).toHaveLength(1);
    const staff = await runAdmin(() => requestAccountDeletion(db, owner), "ok");
    expect(staff.message).toMatch(/Staff accounts/);
  });
});

describe("staff recovery", () => {
  it("a super admin resets another person's two-factor and signs them out", async () => {
    const staff = await makeUser(db, { roles: ["content_editor"], twoFactorEnabled: true });
    await db.insert(sessions).values({ userId: staff.id, token: crypto.randomUUID(), expiresAt: new Date(Date.now() + 86_400_000) });
    const owner = ctxFor(await makeUser(db, { roles: ["super_admin"], twoFactorEnabled: true }), ["super_admin"]);
    await expect(resetTwoFactor(db, ctxFor(staff, ["content_editor"]), owner.userId)).rejects.toBeInstanceOf(AccessDeniedError);
    expect((await runAdmin(() => resetTwoFactor(db, owner, owner.userId), "ok")).ok).toBe(false);
    await resetTwoFactor(db, owner, staff.id);
    const [u] = await db.select().from(users).where(eq(users.id, staff.id));
    expect(u.twoFactorEnabled).toBe(false);
    expect(await db.select().from(sessions).where(eq(sessions.userId, staff.id))).toHaveLength(0);
  });
});

describe("reports", () => {
  it("sums paid orders per currency and day, exports CSV safely", async () => {
    const m = await makeMerchant(db);
    const paidAt = new Date("2026-03-10T15:00:00Z");
    const a = await makeOrder(db, { userId: null, merchantId: m.id, totalMinor: 20_000 });
    const b = await makeOrder(db, { userId: null, merchantId: m.id, totalMinor: 5_000 });
    await makeOrder(db, { userId: null, merchantId: m.id, totalMinor: 99_999 }); // unpaid: excluded
    await db.update(orders).set({ paymentStatus: "paid", paidAt, country: "US", shippingAddress: { fullName: "=HYPERLINK(\"x\")" } }).where(eq(orders.id, a.id));
    await db.update(orders).set({ paymentStatus: "paid", paidAt, country: "BR" }).where(eq(orders.id, b.id));
    await db.insert(orderItems).values({ orderId: a.id, productName: "Jacket", sku: "J-1", unitPriceMinor: 20_000, quantity: 1 });
    const viewer = ctxFor(await makeUser(db, { roles: ["manager"], twoFactorEnabled: true }), ["manager"]);
    const r = await salesReport(db, viewer, { from: "2026-03-10", to: "2026-03-10" });
    expect(r.totals).toEqual([expect.objectContaining({ currency: "USD", orders: 2, revenue: 25_000, average: 12_500 })]);
    expect(r.byDay).toEqual([expect.objectContaining({ day: "2026-03-10", revenue: 25_000 })]);
    expect(r.top[0]).toMatchObject({ name: "Jacket", units: 1 });
    const editor = ctxFor(await makeUser(db, { roles: ["content_editor"], twoFactorEnabled: true }), ["content_editor"]);
    await expect(salesReport(db, editor, {})).rejects.toBeInstanceOf(AccessDeniedError);
    const { csv } = await ordersCsv(db, viewer, { from: "2026-03-10", to: "2026-03-10" });
    expect(csv.split("\r\n")).toHaveLength(3);
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
  });

  it("keeps periods sane", () => {
    const p = resolvePeriod({ from: "2026-05-01", to: "2026-04-01" });
    expect([p.from, p.to]).toEqual(["2026-04-01", "2026-05-01"]);
    const long = resolvePeriod({ from: "2020-01-01", to: "2026-01-01" });
    expect((long.end.getTime() - long.start.getTime()) / 86_400_000).toBeLessThanOrEqual(366);
    expect(resolvePeriod({ from: "garbage" }).to).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("maintenance job", () => {
  it("removes expired sessions and old carts, keeps live ones", async () => {
    const { runMaintenance } = await import("@/server/maintenance");
    const { carts } = await import("@/db/schema");
    const u = await makeUser(db);
    const [old] = await db.insert(sessions).values({ userId: u.id, token: crypto.randomUUID(), expiresAt: new Date(Date.now() - 1000) }).returning();
    const [live] = await db.insert(sessions).values({ userId: u.id, token: crypto.randomUUID(), expiresAt: new Date(Date.now() + 86_400_000) }).returning();
    const [stale] = await db.insert(carts).values({ currency: "USD", updatedAt: new Date(Date.now() - 90 * 86_400_000) }).returning();
    const r = await runMaintenance(db);
    expect(r.sessions).toBeGreaterThanOrEqual(1);
    expect(await db.select().from(sessions).where(eq(sessions.id, old.id))).toHaveLength(0);
    expect(await db.select().from(sessions).where(eq(sessions.id, live.id))).toHaveLength(1);
    expect(await db.select().from(carts).where(eq(carts.id, stale.id))).toHaveLength(0);
  });
});
