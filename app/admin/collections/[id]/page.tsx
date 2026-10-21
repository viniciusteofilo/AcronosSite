import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getDb } from "@/db/client";
import { CollectionEditor } from "@/components/admin/collection-editor";
import { AdminPageHeader } from "@/components/admin/page-header";
import { requireStaff } from "@/server/auth";
import { getCollectionForEditor, listProductChoices } from "@/server/catalog/collections-admin";
import { hasPermission } from "@/server/rbac/permissions";
import { listMediaAction, updateMediaAction } from "../../site/actions";
import { deleteCollectionAction, saveCollectionAction } from "../../products/actions";

export const metadata: Metadata = { title: "Edit collection" };

export default function EditCollectionPage({ params }: PageProps<"/admin/collections/[id]">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <Editor params={params} />
    </Suspense>
  );
}

async function Editor({ params }: Pick<PageProps<"/admin/collections/[id]">, "params">) {
  const ctx = await requireStaff("products:read");
  const { id } = await params;
  const db = getDb();
  const [collection, products] = await Promise.all([getCollectionForEditor(db, ctx, id), listProductChoices(db, ctx)]);
  if (!collection) notFound();
  return (
    <div className="flex flex-col gap-4">
      <AdminPageHeader title={collection.name} back={{ href: "/admin/collections", label: "Collections" }} />
      <CollectionEditor
        key={collection.id}
        initial={collection}
        products={products}
        canEdit={hasPermission(ctx.roles, "products:write")}
        actions={{ save: saveCollectionAction, remove: deleteCollectionAction, updateMedia: updateMediaAction, listMedia: listMediaAction }}
      />
    </div>
  );
}
