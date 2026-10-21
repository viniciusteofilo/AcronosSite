import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getDb } from "@/db/client";
import { LabManager } from "@/components/admin/lab-manager";
import { AdminPageHeader } from "@/components/admin/page-header";
import { requireStaff } from "@/server/auth";
import { listLabAdmin } from "@/server/content/stories-admin";
import { deleteLabItemAction, saveLabProjectAction, saveLabUpdateAction } from "../pages/actions";

export const metadata: Metadata = { title: "Acronos Lab" };

export default function LabAdmin() {
  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        title="Acronos Lab"
        description="Projects and updates of the social project (in planning)."
        actions={
          <Link href="/admin/pages/lab" className="inline-flex h-10 items-center border border-field px-4 font-mono text-[10px] uppercase tracking-[0.14em] hover:border-ink">
            Edit intro text
          </Link>
        }
      />
      <Suspense fallback={<p className="text-muted">Loading…</p>}>
        <Lab />
      </Suspense>
    </div>
  );
}

async function Lab() {
  const ctx = await requireStaff("content:write");
  const data = await listLabAdmin(getDb(), ctx);
  return <LabManager projects={data.projects} updates={data.updates} actions={{ saveProject: saveLabProjectAction, saveUpdate: saveLabUpdateAction, remove: deleteLabItemAction }} />;
}
