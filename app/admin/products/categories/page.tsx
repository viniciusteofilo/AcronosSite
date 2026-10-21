import type { Metadata } from "next";
import { Suspense } from "react";
import { getDb } from "@/db/client";
import { CategoryManager } from "@/components/admin/category-manager";
import { AdminPageHeader } from "@/components/admin/page-header";
import { requireStaff } from "@/server/auth";
import { listCategoriesAdmin } from "@/server/catalog/admin";
import { hasPermission } from "@/server/rbac/permissions";
import { deleteCategoryAction, saveCategoryAction } from "../actions";

export const metadata: Metadata = { title: "Categories" };

export default function CategoriesPage() {
  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        title="Categories"
        back={{ href: "/admin/products", label: "Products" }}
        description="Types of product used in the shop filter (Outerwear, Pants, Accessories…). Collections are for drops and campaigns."
      />
      <Suspense fallback={<p className="text-muted">Loading…</p>}>
        <List />
      </Suspense>
    </div>
  );
}

async function List() {
  const ctx = await requireStaff("products:read");
  const items = await listCategoriesAdmin(getDb(), ctx);
  return <CategoryManager initial={items} canEdit={hasPermission(ctx.roles, "products:write")} save={saveCategoryAction} remove={deleteCategoryAction} />;
}
