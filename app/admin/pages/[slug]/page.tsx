import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getDb } from "@/db/client";
import { AdminPageHeader } from "@/components/admin/page-header";
import { PageEditor } from "@/components/admin/page-editor";
import { requireStaff } from "@/server/auth";
import { getPageForEditor } from "@/server/content/pages-admin";
import { loadPageRevisionAction, savePageAction } from "../actions";

export const metadata: Metadata = { title: "Edit page" };

export default function EditPage({ params }: PageProps<"/admin/pages/[slug]">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <Editor params={params} />
    </Suspense>
  );
}

async function Editor({ params }: Pick<PageProps<"/admin/pages/[slug]">, "params">) {
  const ctx = await requireStaff("content:write");
  const { slug } = await params;
  const page = await getPageForEditor(getDb(), ctx, slug);
  if (!page) notFound();
  return (
    <div className="flex flex-col gap-4">
      <AdminPageHeader title={page.title} back={{ href: "/admin/pages", label: "Pages" }} />
      <PageEditor key={`${slug}:${page.updatedAt}`} page={page} actions={{ save: savePageAction, loadRevision: loadPageRevisionAction }} />
    </div>
  );
}
