import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getDb } from "@/db/client";
import { EMAIL_KINDS } from "@/db/schema";
import { EmailSettings } from "@/components/admin/email-settings";
import { AdminPageHeader } from "@/components/admin/page-header";
import { Panel, dateTime } from "@/components/admin/ui";
import { requireStaff } from "@/server/auth";
import { EMAIL_KIND_LABELS, listEmails } from "@/server/email/admin";
import { emailMode } from "@/server/email/send";
import { getStoreSettings } from "@/server/store/settings";
import { saveNotifyEmailAction, sendTestEmailAction } from "./actions";

export const metadata: Metadata = { title: "E-mails" };

const STATUS = { sent: "Sent", failed: "Failed", not_sent: "Not sent" } as const;

export default function EmailsPage({ searchParams }: PageProps<"/admin/emails">) {
  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader title="E-mails" description="Messages the store sends: account, orders, newsletter confirmation and team notices." />
      <Suspense fallback={<p className="text-muted">Loading…</p>}>
        <Body searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Body({ searchParams }: Pick<PageProps<"/admin/emails">, "searchParams">) {
  const ctx = await requireStaff("settings:manage");
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const db = getDb();
  const [data, settings] = await Promise.all([listEmails(db, ctx, { kind: one(sp.kind), page: one(sp.page) }), getStoreSettings(db)]);
  const mode = emailMode();
  return (
    <>
      <Panel title="Sending">
        {mode === "provider" ? (
          <p className="text-sm">
            <strong>Connected.</strong> E-mails go out through Resend from <span className="font-mono">{process.env.EMAIL_FROM}</span>. Only the subject and recipient are kept here, never the content.
          </p>
        ) : mode === "outbox" ? (
          <div className="flex flex-col gap-2 text-sm">
            <p>
              <strong className="text-alert">Not connected: nothing is sent.</strong> On this test site every e-mail is kept in the list below, marked “Not sent”, so you can open it and follow its link.
            </p>
            <p className="text-muted">
              To send for real: create a free Resend account, verify the ACRONOS domain there, then set <span className="font-mono">RESEND_API_KEY</span> and <span className="font-mono">EMAIL_FROM</span> (e.g. ACRONOS &lt;store@your-domain.com&gt;) in the hosting settings. See docs/EMAIL.md.
            </p>
          </div>
        ) : (
          <p className="text-sm text-alert">
            Not connected: nothing is sent. Customers cannot reset passwords or receive order e-mails until <span className="font-mono">RESEND_API_KEY</span> and <span className="font-mono">EMAIL_FROM</span> are set.
          </p>
        )}
        <EmailSettings notifyEmail={settings.notifyEmail} save={saveNotifyEmailAction} test={sendTestEmailAction} />
      </Panel>

      <nav aria-label="Filter by type" className="flex flex-wrap gap-x-4 gap-y-2 font-mono text-[11px] uppercase tracking-[0.12em]">
        <Link href="/admin/emails" aria-current={!data.kind ? "page" : undefined} className={!data.kind ? "text-ink underline underline-offset-4" : "text-muted hover:text-ink"}>
          All
        </Link>
        {EMAIL_KINDS.map((k) => (
          <Link key={k} href={`/admin/emails?kind=${k}`} aria-current={data.kind === k ? "page" : undefined} className={data.kind === k ? "text-ink underline underline-offset-4" : "text-muted hover:text-ink"}>
            {EMAIL_KIND_LABELS[k]}
          </Link>
        ))}
      </nav>

      {data.items.length === 0 ? (
        <p className="border border-dashed border-field p-8 text-sm">No e-mails yet.</p>
      ) : (
        <div className="overflow-x-auto border border-line bg-surface">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
              <tr className="border-b border-line">
                <th className="p-3 font-normal">When</th>
                <th className="p-3 font-normal">Type</th>
                <th className="p-3 font-normal">To</th>
                <th className="p-3 font-normal">Subject</th>
                <th className="p-3 font-normal">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((e) => (
                <tr key={e.id} className="border-b border-line last:border-0">
                  <td className="whitespace-nowrap p-3 text-muted">{dateTime.format(new Date(e.createdAt))}</td>
                  <td className="p-3">{EMAIL_KIND_LABELS[e.kind]}</td>
                  <td className="p-3 font-mono text-xs">{e.to}</td>
                  <td className="p-3">
                    {e.hasBody ? (
                      <Link href={`/admin/emails/${e.id}`} className="underline underline-offset-4">
                        {e.subject}
                      </Link>
                    ) : (
                      e.subject
                    )}
                  </td>
                  <td className={`p-3 font-mono text-[10px] uppercase tracking-[0.14em] ${e.status === "failed" ? "text-alert" : e.status === "sent" ? "text-signal-ink" : "text-muted"}`}>
                    {STATUS[e.status]}
                    {e.error && <span className="block normal-case tracking-normal">{e.error}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data.pages > 1 && (
        <nav aria-label="Pages" className="flex gap-4 font-mono text-[11px] uppercase tracking-[0.12em]">
          {data.page > 1 && <Link href={`/admin/emails?${new URLSearchParams({ ...(data.kind ? { kind: data.kind } : {}), page: String(data.page - 1) })}`}>← Newer</Link>}
          {data.page < data.pages && <Link href={`/admin/emails?${new URLSearchParams({ ...(data.kind ? { kind: data.kind } : {}), page: String(data.page + 1) })}`}>Older →</Link>}
        </nav>
      )}
    </>
  );
}
