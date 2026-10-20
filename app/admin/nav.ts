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
  { label: "Site editor", href: "/admin/site", permission: "content:write", status: "implemented" },
  { label: "Image library", href: "/admin/media", permission: "content:write", status: "implemented" },
  { label: "Orders", href: "/admin/orders", permission: "orders:read", status: "planned", phase: "05" },
  { label: "Products", href: "/admin/products", permission: "products:read", status: "planned", phase: "04" },
  { label: "Inventory", href: "/admin/inventory", permission: "inventory:adjust", status: "planned", phase: "04" },
  { label: "Collections", href: "/admin/collections", permission: "products:write", status: "planned", phase: "04" },
  { label: "Customers", href: "/admin/customers", permission: "customers:read", status: "planned", phase: "04" },
  { label: "Pages", href: "/admin/content", permission: "content:write", status: "planned", phase: "04" },
  { label: "Acronos Sci-Fi", href: "/admin/sci-fi", permission: "content:write", status: "planned", phase: "04" },
  { label: "Acronos Lab", href: "/admin/lab", permission: "content:write", status: "planned", phase: "04" },
  { label: "Marketing", href: "/admin/marketing", permission: "marketing:write", status: "planned", phase: "04" },
  { label: "Reports", href: "/admin/reports", permission: "reports:view", status: "planned", phase: "04" },
  { label: "Settings", href: "/admin/settings", permission: "settings:manage", status: "planned", phase: "04" },
];
