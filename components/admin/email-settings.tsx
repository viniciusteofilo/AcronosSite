"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import type { ActionResult } from "@/server/admin/errors";
import { Notice, inputClass, primaryButton, secondaryButton } from "./ui";

/** Team address for notifications and a test-send button. */
export function EmailSettings({ notifyEmail, save, test }: { notifyEmail: string | null; save: (v: string) => Promise<ActionResult<unknown>>; test: () => Promise<ActionResult<unknown>> }) {
  const router = useRouter();
  const id = useId();
  const [value, setValue] = useState(notifyEmail ?? "");
  const [msg, setMsg] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, start] = useTransition();
  const run = (p: () => Promise<ActionResult<unknown>>) =>
    start(async () => {
      const r = await p();
      setMsg(r);
      if (r.ok) router.refresh();
    });
  return (
    <div className="flex flex-col gap-4">
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => save(value.trim()));
        }}
      >
        <div className="flex min-w-64 flex-1 flex-col gap-1">
          <label htmlFor={id} className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
            Team e-mail for new messages
          </label>
          <input id={id} type="email" value={value} onChange={(e) => setValue(e.target.value)} placeholder="e.g. contact@your-domain.com" className={inputClass} />
        </div>
        <button type="submit" disabled={pending} className={primaryButton}>
          Save
        </button>
        <button type="button" disabled={pending} onClick={() => run(test)} className={secondaryButton}>
          Send test e-mail to me
        </button>
      </form>
      <Notice result={msg} />
    </div>
  );
}
