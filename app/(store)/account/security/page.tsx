import type { Metadata } from "next";
import { Suspense } from "react";
import { getDb } from "@/db/client";
import { SessionList } from "@/components/account/session-list";
import { listMySessions } from "@/server/account/self-service";
import { requireUser } from "@/server/auth";
import { PasswordForm } from "@/components/account/profile-forms";
import { changePasswordAction, endOtherSessionsAction, endSessionAction } from "../actions";
import { MfaSetup } from "./mfa-setup";

export const metadata: Metadata = { title: "Security", robots: { index: false } };

export default function SecurityPage({ searchParams }: PageProps<"/account/security">) {
  return (
    <>
      <h1 className="font-display text-2xl uppercase tracking-[0.08em]">Security</h1>
      <Suspense fallback={<p className="text-muted">Loading…</p>}>
        <Content searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Content({ searchParams }: Pick<PageProps<"/account/security">, "searchParams">) {
  const ctx = await requireUser("/account/security");
  const { required } = await searchParams;
  return (
    <>
      {required === "mfa" && !ctx.twoFactorEnabled && (
        <p role="status" className="border border-signal p-4 text-sm">
          Staff accounts must turn on two-factor authentication before opening the admin panel.
        </p>
      )}
      <section className="flex flex-col gap-3">
        <h2 className="font-mono text-xs uppercase tracking-[0.12em] text-muted">Password</h2>
        <PasswordForm change={changePasswordAction} />
      </section>
      <MfaSetup enabled={ctx.twoFactorEnabled} />
      <section className="flex flex-col gap-3">
        <h2 className="font-mono text-xs uppercase tracking-[0.12em] text-muted">Where you are signed in</h2>
        <SessionList sessions={await listMySessions(getDb(), ctx)} endOthers={endOtherSessionsAction} endOne={endSessionAction} />
      </section>
    </>
  );
}
