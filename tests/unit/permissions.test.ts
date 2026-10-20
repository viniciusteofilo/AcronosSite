import { describe, expect, it } from "vitest";
import { ROLE_KEYS } from "@/db/schema/rbac";
import { decideStaffAccess, type AccessContext } from "@/server/rbac/access";
import {
  ADMIN_SESSION_MAX_AGE_MS,
  PERMISSIONS,
  hasPermission,
  permissionsFor,
} from "@/server/rbac/permissions";

const base: AccessContext = {
  userId: "00000000-0000-0000-0000-000000000001",
  email: "a@example.test",
  roles: ["manager"],
  twoFactorEnabled: true,
  sessionCreatedAt: new Date("2026-10-20T10:00:00Z"),
};
const now = new Date("2026-10-20T11:00:00Z");

describe("role permission matrix (Phase 01, section 10)", () => {
  it("super admin has every permission", () => {
    expect(permissionsFor(["super_admin"]).size).toBe(PERMISSIONS.length);
  });

  it("only super admin can confirm a payment manually, manage users or read the audit log", () => {
    for (const role of ROLE_KEYS.filter((r) => r !== "super_admin")) {
      expect(hasPermission([role], "payments:manual_confirm")).toBe(false);
      expect(hasPermission([role], "users:manage")).toBe(false);
      expect(hasPermission([role], "audit:read")).toBe(false);
    }
  });

  it("content editor cannot see orders, customers or refunds", () => {
    expect(hasPermission(["content_editor"], "content:write")).toBe(true);
    expect(hasPermission(["content_editor"], "orders:read")).toBe(false);
    expect(hasPermission(["content_editor"], "customers:read")).toBe(false);
    expect(hasPermission(["content_editor"], "orders:refund")).toBe(false);
  });

  it("order manager handles orders but cannot refund, edit products or read full customer data", () => {
    expect(hasPermission(["order_manager"], "orders:update")).toBe(true);
    expect(hasPermission(["order_manager"], "orders:refund")).toBe(false);
    expect(hasPermission(["order_manager"], "products:write")).toBe(false);
    expect(hasPermission(["order_manager"], "customers:read")).toBe(false);
    expect(hasPermission(["order_manager"], "customers:read_shipping")).toBe(true);
  });

  it("a customer (no roles) has no admin permission at all", () => {
    for (const p of PERMISSIONS) expect(hasPermission([], p)).toBe(false);
  });
});

describe("decideStaffAccess", () => {
  it("rejects anonymous visitors", () => {
    expect(decideStaffAccess(null, null, now)).toEqual({ ok: false, reason: "unauthenticated" });
  });

  it("rejects signed-in customers", () => {
    expect(decideStaffAccess({ ...base, roles: [] }, null, now)).toEqual({ ok: false, reason: "not_staff" });
  });

  it("rejects staff without two-factor authentication, even super admins", () => {
    const r = decideStaffAccess({ ...base, roles: ["super_admin"], twoFactorEnabled: false }, null, now);
    expect(r).toEqual({ ok: false, reason: "mfa_required" });
  });

  it("rejects admin sessions older than the admin limit", () => {
    const old = new Date(now.getTime() - ADMIN_SESSION_MAX_AGE_MS - 1);
    expect(decideStaffAccess({ ...base, sessionCreatedAt: old }, null, now)).toEqual({
      ok: false,
      reason: "session_too_old",
    });
  });

  it("rejects a permission the role does not grant", () => {
    expect(decideStaffAccess({ ...base, roles: ["content_editor"] }, "orders:read", now)).toEqual({
      ok: false,
      reason: "forbidden",
    });
  });

  it("allows a permission the role grants", () => {
    expect(decideStaffAccess(base, "orders:refund", now).ok).toBe(true);
  });
});
