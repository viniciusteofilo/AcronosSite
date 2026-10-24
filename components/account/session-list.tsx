"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type Session = { id: string; current: boolean; device: string; ipAddress: string | null; createdAt: string; lastActive: string };
type Result = { ok: boolean; message: string };

/** Where the account is signed in, with a way to sign out of the others. */
export function SessionList({ sessions, endOthers, endOne }: { sessions: Session[]; endOthers: () => Promise<Result>; endOne: (id: string) => Promise<Result> }) {
  const router = useRouter();
  const [msg, setMsg] = useState<Result | null>(null);
  const [pending, start] = useTransition();
  const run = (p: Promise<Result>) =>
    start(async () => {
      const r = await p;
      setMsg(r);
      if (r.ok) router.refresh();
    });
  const d = (iso: string) => new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
  return (
    <div className="flex flex-col gap-3">
      <ul className="divide-y divide-line border-y border-line text-sm">
        {sessions.map((s) => (
          <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
            <span>
              {s.device}
              {s.current && <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.14em] text-signal-ink">This device</span>}
              <span className="block text-xs text-muted">
                {s.ipAddress || "unknown IP"} · signed in {d(s.createdAt)} · active {d(s.lastActive)}
              </span>
            </span>
            {!s.current && (
              <button type="button" disabled={pending} onClick={() => run(endOne(s.id))} className="font-mono text-[10px] uppercase tracking-[0.14em] text-alert hover:underline">
                Sign out
              </button>
            )}
          </li>
        ))}
      </ul>
      {sessions.length > 1 && (
        <button type="button" disabled={pending} onClick={() => run(endOthers())} className="self-start border border-field px-4 py-2 font-mono text-[10px] uppercase tracking-[0.14em] hover:border-ink">
          Sign out of all other devices
        </button>
      )}
      {msg && (
        <p role={msg.ok ? "status" : "alert"} className={`text-sm ${msg.ok ? "" : "text-alert"}`}>
          {msg.message}
        </p>
      )}
    </div>
  );
}

/** Asks ACRONOS to erase the account; needs a second click to confirm. */
export function DeleteAccount({ request }: { request: () => Promise<Result> }) {
  const [confirm, setConfirm] = useState(false);
  const [msg, setMsg] = useState<Result | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-col gap-2">
      {confirm ? (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          Erase my account and personal data?
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                setMsg(await request());
                setConfirm(false);
              })
            }
            className="bg-alert px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-paper"
          >
            Yes, request deletion
          </button>
          <button type="button" onClick={() => setConfirm(false)} className="underline">
            Cancel
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => setConfirm(true)} className="self-start font-mono text-[10px] uppercase tracking-[0.14em] text-alert underline">
          Delete my account
        </button>
      )}
      {msg && (
        <p role={msg.ok ? "status" : "alert"} className={`text-sm ${msg.ok ? "" : "text-alert"}`}>
          {msg.message}
        </p>
      )}
    </div>
  );
}
