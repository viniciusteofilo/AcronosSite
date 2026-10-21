import type { Metadata } from "next";
import { Suspense } from "react";
import { getDb } from "@/db/client";
import { FreshOnNavigate } from "@/components/admin/fresh-on-navigate";
import { AdminPageHeader } from "@/components/admin/page-header";
import { ProductEditor } from "@/components/admin/product-editor";
import { requireStaff } from "@/server/auth";
import { getProductEditorOptions } from "@/server/catalog/admin";
import { hasPermission } from "@/server/rbac/permissions";
import { listMediaAction, updateMediaAction } from "../../site/actions";
import {
  deleteProductAction,
  duplicateProductAction,
  saveCategoryAction,
  saveProductAction,
} from "../actions";

export const metadata: Metadata = { title: "New product" };

export default function NewProductPage() {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <Editor />
    </Suspense>
  );
}

async function Editor() {
  const ctx = await requireStaff("products:write");
  const options = await getProductEditorOptions(getDb(), ctx);
  return (
    <div className="flex flex-col gap-4">
      <AdminPageHeader
        title="New product"
        back={{ href: "/admin/products", label: "Products" }}
      />
      <FreshOnNavigate>
        <ProductEditor
          product={null}
          options={options}
          canEdit
          canAdjustStock={hasPermission(ctx.roles, "inventory:adjust")}
          actions={{
            save: saveProductAction,
            duplicate: duplicateProductAction,
            remove: deleteProductAction,
            saveCategory: saveCategoryAction,
            updateMedia: updateMediaAction,
            listMedia: listMediaAction,
          }}
        />
      </FreshOnNavigate>
    </div>
  );
}
