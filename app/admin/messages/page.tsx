import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getDb } from "@/db/client";
import { AdminPageHeader } from "@/components/admin/page-header";
import { ActionButton } from "@/components/admin/row-actions";
import { requireStaff } from "@/server/auth";
import { listMessages } from "@/server/admin/people";
import { setMessageStatusAction } from "../pages/actions";

export const metadata: Metadata = { title: "Messages" };

const TABS = [
  ["all", "All"],
  ["new", "New"],
  ["open", "Open"],
  ["closed", "Closed"],
] as const;
const TOPIC = { order: "Order", product: "Product", wholesale: "Wholesale", press: "Press", lab: "Acronos Lab", other: "Other" } as const;

export default function MessagesPage({ searchParams }: PageProps<"/admin/messages">) {
  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader title="Messages" description="Sent from the contact page. Reply from your e-mail; mark them here to keep track." />
      <Suspense fallback={<p className="text-muted">Loading…</p>}>
        <List searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function List({ searchParams }: Pick<PageProps<"/admin/messages">, "searchParams">) {
  const ctx = await requireStaff("customers:read");
  const sp = await searchParams;
  const data = await listMessages(getDb(), ctx, { status: Array.isArray(sp.status) ? sp.status[0] : sp.status });
  return (
    <>
      <nav aria-label="Filter" className="flex gap-4 font-mono text-[11px] uppercase tracking-[0.12em]">
        {TABS.map(([k, l]) => (
          <Link key={k} href={k === "all" ? "/admin/messages" : `/admin/messages?status=${k}`} aria-current={data.status === k ? "page" : undefined} className={data.status === k ? "text-ink underline underline-offset-4" : "text-muted hover:text-ink"}>
            {l}
            {k !== "all" && <span className="text-muted"> ({data.counts[k] ?? 0})</span>}
          </Link>
        ))}
      </nav>
      {data.items.length === 0 ? (
        <p className="border border-dashed border-field p-8 text-sm">No messages here.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {data.items.map((m) => (
            <li key={m.id} className={`flex flex-col gap-3 border bg-surface p-4 ${m.status === "new" ? "border-ink" : "border-line"}`}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span>
                  <strong className="font-medium">{m.name}</strong>{" "}
                  <a href={`mailto:${m.email}`} className="text-sm underline">
                    {m.email}
                  </a>
                </span>
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
                  {TOPIC[m.topic]} · {m.status} · {new Date(m.createdAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
                </span>
              </div>
              <p className="whitespace-pre-line text-sm">{m.message}</p>
              <div className="flex gap-2">
                {m.status !== "open" && <ActionButton label="Mark open" run={setMessageStatusAction.bind(null, m.id, "open")} />}
                {m.status !== "closed" && <ActionButton label="Close" run={setMessageStatusAction.bind(null, m.id, "closed")} />}
                {m.status === "closed" && <ActionButton label="Reopen" run={setMessageStatusAction.bind(null, m.id, "open")} />}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
