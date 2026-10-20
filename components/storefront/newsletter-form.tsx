"use client";

import { useActionState, useId } from "react";
import { Button } from "@/components/ui/button";
import type { FormResult } from "@/server/marketing/forms";

export function NewsletterForm({
  action,
  source = "footer",
}: {
  action: (prev: FormResult | null, form: FormData) => Promise<FormResult>;
  source?: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const id = useId();
  const values = state && !state.ok ? state.values : undefined;
  if (state?.ok) {
    return (
      <p role="status" className="max-w-sm border border-line bg-surface p-4 text-sm">
        {state.message}
      </p>
    );
  }
  return (
    <form action={formAction} className="flex max-w-sm flex-col gap-3" aria-label="Newsletter" noValidate>
      <label htmlFor={`${id}-email`} className="text-sm">
        Releases, stories and Lab updates. No spam.
      </label>
      <div className="flex">
        <input
          key={`email-${values?.email ?? ""}`}
          defaultValue={values?.email}
          id={`${id}-email`}
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="Email address"
          aria-invalid={state && !state.ok && state.field === "email" ? true : undefined}
          className="h-12 min-w-0 flex-1 border border-r-0 border-field bg-surface px-4 text-sm placeholder:text-muted"
        />
        <Button type="submit" disabled={pending} className="shrink-0">
          {pending ? "Sending…" : "Subscribe"}
        </Button>
      </div>
      <label className="flex items-start gap-3 text-xs text-muted">
        <input
          type="checkbox"
          name="consent"
          required
          className="mt-0.5 h-4 w-4 shrink-0 appearance-none border border-field bg-surface checked:border-ink checked:bg-ink"
        />
        I agree to receive e-mails from ACRONOS. I can unsubscribe at any time.
      </label>
      {/* Honeypot for bots: hidden from people and screen readers. */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
      <input type="hidden" name="source" value={source} />
      {state && !state.ok && (
        <p role="alert" className="text-xs text-alert">
          {state.message}
        </p>
      )}
    </form>
  );
}
