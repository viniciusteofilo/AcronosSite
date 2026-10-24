import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getDb } from "@/db/client";
import { AdminPageHeader } from "@/components/admin/page-header";
import { dateTime } from "@/components/admin/ui";
import { requireStaff } from "@/server/auth";
import { EMAIL_KIND_LABELS, getEmail } from "@/server/email/admin";

export const metadata: Metadata = { title: "E-mail" };

export default function EmailPage({ params }: PageProps<"/admin/emails/[id]">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <Body params={params} />
    </Suspense>
  );
}

async function Body({ params }: Pick<PageProps<"/admin/emails/[id]">, "params">) {
  const ctx = await requireStaff("settings:manage");
  const e = await getEmail(getDb(), ctx, (await params).id);
  if (!e || !e.bodyHtml) notFound();
  return (
    <div className="flex flex-col gap-6">
      <Link href="/admin/emails" className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted hover:text-ink">
        ← E-mails
      </Link>
      <AdminPageHeader title={e.subject} description={`${EMAIL_KIND_LABELS[e.kind]} · to ${e.to} · ${dateTime.format(e.createdAt)} · not sent (test outbox)`} />
      {/* sandboxed: no scripts, no same-origin access; links open in a new tab */}
      <iframe title="E-mail content" sandbox="allow-popups allow-popups-to-escape-sandbox" srcDoc={e.bodyHtml.replace("<head>", "<head><base target=\"_blank\">").replace("<html>", "<html><head><base target=\"_blank\"></head>")} className="h-[720px] w-full border border-line bg-paper" />
    </div>
  );
}
