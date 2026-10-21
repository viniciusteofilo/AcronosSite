import type { Permission } from "@/server/rbac/permissions";

export type AdminNavItem = {
  label: string;
  href: string;
  permission: Permission;
  /** "implemented" items are links; "planned" items are shown as such, never as working screens. */
  status: "implemented" | "planned";
  phase?: string;
};

export const ADMIN_NAV: AdminNavItem[] = [
  { label: "Dashboard", href: "/admin", permission: "dashboard:view", status: "implemented" },
  { label: "Orders", href: "/admin/orders", permission: "orders:read", status: "planned", phase: "05" },
  { label: "Products", href: "/admin/products", permission: "products:read", status: "implemented" },
  { label: "Collections", href: "/admin/collections", permission: "products:read", status: "implemented" },
  { label: "Inventory", href: "/admin/inventory", permission: "inventory:adjust", status: "implemented" },
  { label: "Site editor", href: "/admin/site", permission: "content:write", status: "implemented" },
  { label: "Image library", href: "/admin/media", permission: "content:write", status: "implemented" },
  { label: "Pages", href: "/admin/pages", permission: "content:write", status: "implemented" },
  { label: "Acronos Sci-Fi", href: "/admin/sci-fi", permission: "content:write", status: "implemented" },
  { label: "Acronos Lab", href: "/admin/lab", permission: "content:write", status: "implemented" },
  { label: "Customers", href: "/admin/customers", permission: "customers:read", status: "implemented" },
  { label: "Messages", href: "/admin/messages", permission: "customers:read", status: "implemented" },
  { label: "Newsletter", href: "/admin/marketing", permission: "marketing:write", status: "implemented" },
  { label: "Reports", href: "/admin/reports", permission: "reports:view", status: "planned", phase: "05" },
  { label: "Users", href: "/admin/users", permission: "users:manage", status: "implemented" },
  { label: "Settings", href: "/admin/settings", permission: "settings:manage", status: "planned", phase: "05" },
];
