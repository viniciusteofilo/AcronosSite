import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AdminPageHeader } from "@/components/admin/page-header";
import { StoryImporter } from "@/components/admin/story-importer";
import { requireStaff } from "@/server/auth";
import { importStoryAction } from "../../pages/actions";

export const metadata: Metadata = { title: "Import stories" };

export default function ImportStoriesPage() {
  return (
    <div className="flex flex-col gap-6">
      <Link href="/admin/sci-fi" className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted hover:text-ink">
        ← Acronos Sci-Fi
      </Link>
      <AdminPageHeader title="Import stories" description="Bring finished stories in from files. Only the formatting is converted; the text is not changed." />
      <Suspense fallback={<p className="text-muted">Loading…</p>}>
        <Gate />
      </Suspense>
    </div>
  );
}

async function Gate() {
  await requireStaff("content:write");
  return <StoryImporter importOne={importStoryAction} />;
}
