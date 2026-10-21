import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getDb } from "@/db/client";
import { AdminPageHeader } from "@/components/admin/page-header";
import { ProductEditor } from "@/components/admin/product-editor";
import { requireStaff } from "@/server/auth";
import { getProductEditorOptions, getProductForEditor } from "@/server/catalog/admin";
import { hasPermission } from "@/server/rbac/permissions";
import { listMediaAction, updateMediaAction } from "../../site/actions";
import { deleteProductAction, duplicateProductAction, saveCategoryAction, saveProductAction } from "../actions";

export const metadata: Metadata = { title: "Edit product" };

export default function EditProductPage({ params, searchParams }: PageProps<"/admin/products/[id]">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading product…</p>}>
      <Editor params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Editor({ params, searchParams }: Pick<PageProps<"/admin/products/[id]">, "params" | "searchParams">) {
  const ctx = await requireStaff("products:read");
  const { id } = await params;
  const { created } = await searchParams;
  const db = getDb();
  const [product, options] = await Promise.all([getProductForEditor(db, ctx, id), getProductEditorOptions(db, ctx)]);
  if (!product) notFound();
  return (
    <div className="flex flex-col gap-4">
      <AdminPageHeader title={product.name} back={{ href: "/admin/products", label: "Products" }} />
      <ProductEditor
        key={`${product.id}:${product.updatedAt}`}
        product={product}
        options={options}
        created={created === "1"}
        canEdit={hasPermission(ctx.roles, "products:write")}
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
    </div>
  );
}
