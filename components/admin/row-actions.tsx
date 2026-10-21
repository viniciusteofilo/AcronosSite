"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { ActionResult } from "@/server/admin/errors";
import { inputClass, smallButton } from "./ui";

/** A small button that runs a server action and refreshes the page. */
export function ActionButton({ label, run, danger, confirm }: { label: string; run: () => Promise<ActionResult<unknown>>; danger?: boolean; confirm?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const go = () =>
    start(async () => {
      const r = await run();
      if (r.ok) router.refresh();
      else setError(r.message);
      setAsking(false);
    });
  return (
    <span className="inline-flex flex-col items-end gap-1">
      {confirm && asking ? (
        <span className="flex items-center gap-2 text-xs">
          {confirm}
          <button type="button" disabled={pending} onClick={go} className="h-8 bg-alert px-3 font-mono text-[10px] uppercase tracking-[0.14em] text-paper">
            Yes
          </button>
          <button type="button" onClick={() => setAsking(false)} className="h-8 px-2 text-xs underline">
            No
          </button>
        </span>
      ) : (
        <button type="button" disabled={pending} onClick={() => (confirm ? setAsking(true) : go())} className={danger ? "px-2 font-mono text-[10px] uppercase tracking-[0.14em] text-alert hover:underline" : smallButton}>
          {pending ? "…" : label}
        </button>
      )}
      {error && (
        <span role="alert" className="text-xs text-alert">
          {error}
        </span>
      )}
    </span>
  );
}

const ROLE_LABELS = { super_admin: "Super admin", manager: "Manager", content_editor: "Content editor", order_manager: "Order manager" } as const;

export function GrantRoleForm({ grant }: { grant: (input: unknown) => Promise<ActionResult<unknown>> }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<keyof typeof ROLE_LABELS>("content_editor");
  const [msg, setMsg] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="flex flex-wrap items-end gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await grant({ email, role });
          setMsg(r);
          if (r.ok) {
            setEmail("");
            router.refresh();
          }
        });
      }}
    >
      <label className="flex flex-col gap-1 text-xs text-muted">
        E-mail of an existing account
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={`${inputClass} w-72`} />
      </label>
      <label className="flex flex-col gap-1 text-xs text-muted">
        Role
        <select value={role} onChange={(e) => setRole(e.target.value as keyof typeof ROLE_LABELS)} className={`${inputClass} w-48`}>
          {Object.entries(ROLE_LABELS).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" disabled={pending} className="h-10 bg-ink px-5 font-mono text-[10px] uppercase tracking-[0.14em] text-canvas hover:bg-muted disabled:opacity-50">
        Add role
      </button>
      {msg && (
        <p role={msg.ok ? "status" : "alert"} className={`w-full text-sm ${msg.ok ? "" : "text-alert"}`}>
          {msg.message}
        </p>
      )}
    </form>
  );
}
