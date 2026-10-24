"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition, type FormEvent } from "react";
import type { ActionResult } from "@/server/admin/errors";

type Run = () => Promise<ActionResult<unknown>>;
const btn =
  "h-10 border border-ink bg-ink px-4 font-mono text-[10px] uppercase tracking-[0.14em] text-canvas hover:bg-muted disabled:opacity-50";
const input =
  "h-11 w-full border border-line bg-surface px-3 text-sm text-ink hover:border-muted/60";
const labelCls = "font-mono text-[10px] uppercase tracking-[0.18em] text-muted";

function Message({ r }: { r: { ok: boolean; message: string } | null }) {
  if (!r) return null;
  return (
    <p
      role={r.ok ? "status" : "alert"}
      className={`text-sm ${r.ok ? "" : "text-alert"}`}
    >
      {r.message}
    </p>
  );
}

function useRun() {
  const router = useRouter();
  const [msg, setMsg] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, start] = useTransition();
  const run = (p: Run, after?: () => void) =>
    start(async () => {
      const r = await p();
      setMsg(r);
      if (r.ok) {
        after?.();
        router.refresh();
      }
    });
  return { msg, pending, run };
}

export function NameForm({
  name,
  save,
}: {
  name: string;
  save: (name: string) => Promise<ActionResult<unknown>>;
}) {
  const id = useId();
  const [value, setValue] = useState(name);
  const { msg, pending, run } = useRun();
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => save(value));
      }}
    >
      <label htmlFor={id} className={labelCls}>
        Name
      </label>
      <div className="flex gap-2">
        <input
          id={id}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoComplete="name"
          maxLength={120}
          className={input}
        />
        <button
          type="submit"
          disabled={pending || value.trim() === name}
          className={btn}
        >
          Save
        </button>
      </div>
      <Message r={msg} />
    </form>
  );
}

export function VerifyNotice({ resend }: { resend: Run }) {
  const { msg, pending, run } = useRun();
  return (
    <div className="flex flex-col gap-2 border border-signal/60 p-4 text-sm">
      <p>
        Your e-mail is not confirmed yet. Open the link we sent you, or ask for
        a new one.
      </p>
      <button
        type="button"
        disabled={pending}
        onClick={() => run(resend)}
        className="self-start font-mono text-[10px] uppercase tracking-[0.14em] underline underline-offset-4"
      >
        Send a new link
      </button>
      <Message r={msg} />
    </div>
  );
}

export function PasswordForm({
  change,
}: {
  change: (input: unknown) => Promise<ActionResult<unknown>>;
}) {
  const { msg, pending, run } = useRun();
  const [local, setLocal] = useState<string | null>(null);
  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    const f = new FormData(formEl);
    const currentPassword = String(f.get("currentPassword") ?? "");
    const newPassword = String(f.get("newPassword") ?? "");
    setLocal(null);
    if (newPassword.length < 12) return setLocal("Use at least 12 characters.");
    if (newPassword !== String(f.get("confirm") ?? ""))
      return setLocal("The two new passwords are different.");
    run(
      () => change({ currentPassword, newPassword }),
      () => formEl.reset(),
    );
  }
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      {(
        [
          ["currentPassword", "Current password", "current-password"],
          [
            "newPassword",
            "New password (at least 12 characters)",
            "new-password",
          ],
          ["confirm", "Repeat new password", "new-password"],
        ] as const
      ).map(([name, label, ac]) => (
        <div key={name} className="flex flex-col gap-2">
          <label htmlFor={`pw-${name}`} className={labelCls}>
            {label}
          </label>
          <input
            id={`pw-${name}`}
            name={name}
            type="password"
            autoComplete={ac}
            required
            maxLength={128}
            className={input}
          />
        </div>
      ))}
      {local && (
        <p role="alert" className="text-sm text-alert">
          {local}
        </p>
      )}
      <Message r={msg} />
      <button type="submit" disabled={pending} className={`${btn} self-start`}>
        {pending ? "Saving…" : "Change password"}
      </button>
    </form>
  );
}
