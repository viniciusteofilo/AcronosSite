import type { Metadata } from "next";
import { Suspense } from "react";
import { getDb } from "@/db/client";
import { CollectionEditor } from "@/components/admin/collection-editor";
import { FreshOnNavigate } from "@/components/admin/fresh-on-navigate";
import { AdminPageHeader } from "@/components/admin/page-header";
import { requireStaff } from "@/server/auth";
import { listProductChoices } from "@/server/catalog/collections-admin";
import { listMediaAction, updateMediaAction } from "../../site/actions";
import {
  deleteCollectionAction,
  saveCollectionAction,
} from "../../products/actions";

export const metadata: Metadata = { title: "New collection" };

export default function NewCollectionPage() {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <Editor />
    </Suspense>
  );
}

async function Editor() {
  const ctx = await requireStaff("products:write");
  const products = await listProductChoices(getDb(), ctx);
  return (
    <div className="flex flex-col gap-4">
      <AdminPageHeader
        title="New collection"
        back={{ href: "/admin/collections", label: "Collections" }}
      />
      <FreshOnNavigate>
        <CollectionEditor
          initial={null}
          products={products}
          canEdit
          actions={{
            save: saveCollectionAction,
            remove: deleteCollectionAction,
            updateMedia: updateMediaAction,
            listMedia: listMediaAction,
          }}
        />
      </FreshOnNavigate>
    </div>
  );
}
