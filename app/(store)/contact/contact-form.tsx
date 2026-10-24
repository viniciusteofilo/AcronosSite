"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import type { FormResult } from "@/server/marketing/forms";

const TOPICS = [
  ["order", "An order"],
  ["product", "A product"],
  ["wholesale", "Wholesale"],
  ["press", "Press"],
  ["lab", "Acronos Lab"],
  ["other", "Something else"],
] as const;

export function ContactForm({ action }: { action: (prev: FormResult | null, form: FormData) => Promise<FormResult> }) {
  const [state, formAction, pending] = useActionState(action, null);
  if (state?.ok) {
    return (
      <p role="status" className="border border-line bg-surface p-6">
        {state.message}
      </p>
    );
  }
  const err = (f: string) => (state && !state.ok && state.field === f ? state.message : undefined);
  const v = state && !state.ok ? (state.values ?? {}) : {};
  const k = JSON.stringify(v); // remount fields with the echoed values after an error
  return (
    <form action={formAction} className="flex max-w-xl flex-col gap-6" noValidate>
      <Field key={`n${k}`} defaultValue={v.name} id="contact-name" name="name" label="Name" autoComplete="name" required error={err("name")} />
      <Field key={`e${k}`} defaultValue={v.email} id="contact-email" name="email" label="Email" type="email" autoComplete="email" required error={err("email")} />
      <div className="flex flex-col gap-2">
        <label htmlFor="contact-topic" className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
          Topic
        </label>
        <select key={`t${k}`} id="contact-topic" name="topic" defaultValue={v.topic || "other"} className="h-12 rounded-sm border border-field bg-surface px-4">
          {TOPICS.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor="contact-message" className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
          Message
        </label>
        <textarea
          key={`m${k}`}
          defaultValue={v.message}
          id="contact-message"
          name="message"
          rows={6}
          required
          aria-invalid={err("message") ? true : undefined}
          aria-describedby={err("message") ? "contact-message-error" : undefined}
          className={`rounded-sm border bg-surface p-4 ${err("message") ? "border-alert" : "border-field"}`}
        />
        {err("message") && (
          <p id="contact-message-error" className="text-xs text-alert">
            {err("message")}
          </p>
        )}
      </div>
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
      {state && !state.ok && !state.field && (
        <p role="alert" className="text-sm text-alert">
          {state.message}
        </p>
      )}
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Sending…" : "Send message"}
        </Button>
      </div>
    </form>
  );
}
