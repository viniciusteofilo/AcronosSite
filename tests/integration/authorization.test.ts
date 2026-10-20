import { afterAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { auditLogs, userRoles } from "@/db/schema";
import { getOrderForCustomer, listOrdersForCustomer } from "@/server/customers/orders";
import { decideStaffAccess, loadAccessContext, AccessDeniedError } from "@/server/rbac/access";
import { grantRole, revokeRole } from "@/server/rbac/roles";
import { getDashboardMetrics } from "@/server/reports/dashboard";
import { ctxFor, makeMerchant, makeOrder, makeUser, testDb } from "../helpers";

const { db, client } = testDb();
afterAll(() => client.end());

describe("customers can only reach their own data (IDOR)", () => {
  it("a customer cannot read another customer's order by id", async () => {
    const merchant = await makeMerchant(db);
    const alice = await makeUser(db);
    const bob = await makeUser(db);
    const bobOrder = await makeOrder(db, { userId: bob.id, merchantId: merchant.id });

    expect(await getOrderForCustomer(db, alice.id, bobOrder.id)).toBeNull();
    expect(await getOrderForCustomer(db, bob.id, bobOrder.id)).not.toBeNull();
  });

  it("order history lists only the signed-in customer's orders", async () => {
    const merchant = await makeMerchant(db);
    const alice = await makeUser(db);
    const bob = await makeUser(db);
    await makeOrder(db, { userId: bob.id, merchantId: merchant.id });
    const mine = await makeOrder(db, { userId: alice.id, merchantId: merchant.id });

    const list = await listOrdersForCustomer(db, alice.id);
    expect(list.map((o) => o.id)).toEqual([mine.id]);
  });
});

describe("staff access is decided from the database, not the client", () => {
  it("roles and MFA state are loaded from the database", async () => {
    const editor = await makeUser(db, { roles: ["content_editor"], twoFactorEnabled: true });
    const ctx = await loadAccessContext(db, { userId: editor.id, createdAt: new Date() });
    expect(ctx?.roles).toEqual(["content_editor"]);
    expect(decideStaffAccess(ctx, "content:write").ok).toBe(true);
    expect(decideStaffAccess(ctx, "orders:read")).toEqual({ ok: false, reason: "forbidden" });
  });

  it("a staff member who has not enabled MFA is refused", async () => {
    const manager = await makeUser(db, { roles: ["manager"], twoFactorEnabled: false });
    const ctx = await loadAccessContext(db, { userId: manager.id, createdAt: new Date() });
    expect(decideStaffAccess(ctx, "dashboard:view")).toEqual({ ok: false, reason: "mfa_required" });
  });

  it("an unknown user id yields no access context", async () => {
    const ctx = await loadAccessContext(db, {
      userId: "00000000-0000-0000-0000-00000000dead",
      createdAt: new Date(),
    });
    expect(ctx).toBeNull();
  });
});

describe("role management", () => {
  it("a manager cannot grant roles (privilege escalation)", async () => {
    const manager = await makeUser(db, { roles: ["manager"], twoFactorEnabled: true });
    await expect(
      grantRole(db, ctxFor(manager, ["manager"]), { targetUserId: manager.id, role: "super_admin" }),
    ).rejects.toBeInstanceOf(AccessDeniedError);
    const rows = await db
      .select()
      .from(userRoles)
      .where(and(eq(userRoles.userId, manager.id), eq(userRoles.role, "super_admin")));
    expect(rows).toHaveLength(0);
  });

  it("a super admin grants a role and the change is audited", async () => {
    const admin = await makeUser(db, { roles: ["super_admin"], twoFactorEnabled: true });
    const target = await makeUser(db);
    await grantRole(db, ctxFor(admin, ["super_admin"]), { targetUserId: target.id, role: "order_manager" });

    const roles = await db.select().from(userRoles).where(eq(userRoles.userId, target.id));
    expect(roles.map((r) => r.role)).toEqual(["order_manager"]);
    const audit = await db
      .select()
      .from(auditLogs)
      .where(and(eq(auditLogs.entityId, target.id), eq(auditLogs.action, "role.grant")));
    expect(audit).toHaveLength(1);
    expect(audit[0].actorId).toBe(admin.id);
  });

  it("rejects invalid input on the server", async () => {
    const admin = await makeUser(db, { roles: ["super_admin"], twoFactorEnabled: true });
    await expect(
      grantRole(db, ctxFor(admin, ["super_admin"]), { targetUserId: "not-a-uuid", role: "owner" }),
    ).rejects.toThrow();
  });

  it("a super admin cannot remove their own super admin role (lock-out protection)", async () => {
    const admin = await makeUser(db, { roles: ["super_admin"], twoFactorEnabled: true });
    await expect(
      revokeRole(db, ctxFor(admin, ["super_admin"]), { targetUserId: admin.id, role: "super_admin" }),
    ).rejects.toThrow(/cannot remove their own/);
  });
});

describe("dashboard metrics", () => {
  it("are refused to roles without dashboard access", async () => {
    const editor = await makeUser(db, { roles: ["content_editor"], twoFactorEnabled: true });
    await expect(getDashboardMetrics(db, ctxFor(editor, ["content_editor"]), 30)).rejects.toBeInstanceOf(
      AccessDeniedError,
    );
  });

  it("count only paid orders from the database", async () => {
    const admin = await makeUser(db, { roles: ["super_admin"], twoFactorEnabled: true });
    const before = await getDashboardMetrics(db, ctxFor(admin, ["super_admin"]), 30);
    const merchant = await makeMerchant(db);
    await makeOrder(db, { userId: null, merchantId: merchant.id }); // pending, must not count
    const after = await getDashboardMetrics(db, ctxFor(admin, ["super_admin"]), 30);
    expect(after.paidOrders).toBe(before.paidOrders);
  });
});
