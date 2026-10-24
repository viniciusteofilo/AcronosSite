"use client";

import { useActionState } from "react";

export function NewsletterLinkForm({ action, token, purpose, label }: { action: (p: unknown, f: FormData) => Promise<{ ok: boolean; message: string }>; token: string; purpose: string; label: string }) {
  const [state, run, pending] = useActionState(action, null);
  if (state?.ok)
    return (
      <p role="status" className="text-sm">
        {state.message}
      </p>
    );
  return (
    <form action={run} className="flex flex-col items-start gap-3">
      <input type="hidden" name="t" value={token} />
      <input type="hidden" name="purpose" value={purpose} />
      <button type="submit" disabled={pending} className="h-12 bg-ink px-6 font-mono text-[11px] uppercase tracking-[0.18em] text-canvas hover:bg-muted disabled:opacity-60">
        {label}
      </button>
      {state && !state.ok && (
        <p role="alert" className="text-sm text-alert">
          {state.message}
        </p>
      )}
    </form>
  );
}
