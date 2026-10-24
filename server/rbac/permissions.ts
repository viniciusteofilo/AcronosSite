import type { RoleKey } from "@/db/schema/rbac";

/**
 * Permission model (Phase 01 document, section 10). Least privilege: a role only gets
 * what is listed here. Customers have no role and therefore no admin permission.
 */
export const PERMISSIONS = [
  "dashboard:view",
  "reports:view",
  "reports:export",
  "products:read",
  "products:write",
  "inventory:adjust",
  "orders:read",
  "orders:update",
  "orders:refund",
  "payments:manual_confirm",
  "customers:read",
  "customers:read_shipping",
  "privacy:handle",
  "content:write",
  "marketing:write",
  "users:manage",
  "settings:manage",
  "audit:read",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const ALL: readonly Permission[] = PERMISSIONS;

export const ROLE_PERMISSIONS: Record<RoleKey, readonly Permission[]> = {
  super_admin: ALL,
  manager: [
    "dashboard:view",
    "reports:view",
    "reports:export",
    "products:read",
    "products:write",
    "inventory:adjust",
    "orders:read",
    "orders:update",
    "orders:refund",
    "customers:read",
    "customers:read_shipping",
    "content:write",
    "marketing:write",
  ],
  content_editor: ["content:write", "products:read"],
  order_manager: ["dashboard:view", "orders:read", "orders:update", "customers:read_shipping"],
};

export function permissionsFor(roles: readonly RoleKey[]): Set<Permission> {
  const result = new Set<Permission>();
  for (const role of roles) for (const p of ROLE_PERMISSIONS[role] ?? []) result.add(p);
  return result;
}

export function hasPermission(roles: readonly RoleKey[], permission: Permission): boolean {
  return permissionsFor(roles).has(permission);
}

/** Any staff role grants access to the admin area (each page still checks its own permission). */
export function isStaff(roles: readonly RoleKey[]): boolean {
  return roles.length > 0;
}

/** Admin sessions older than this must sign in again, even if the cookie is still valid. */
export const ADMIN_SESSION_MAX_AGE_MS = 8 * 60 * 60 * 1000;
