"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { authClient } from "@/lib/auth-client";

export function ResetForm({ token }: { token: string }) {
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    const password = String(form.get("password") ?? "");
    if (password.length < 12) return setError("Use at least 12 characters.");
    if (password !== String(form.get("confirm") ?? "")) return setError("The two passwords are different.");
    setPending(true);
    const { error } = await authClient.resetPassword({ newPassword: password, token });
    setPending(false);
    if (error) return setError(error.status === 400 ? "This link is not valid or has expired. Ask for a new one." : "The password could not be changed. Try again.");
    setDone(true);
  }

  if (done)
    return (
      <div role="status" className="flex flex-col gap-4 text-sm">
        <p>Your password was changed and every device was signed out.</p>
        <Link href="/login" className="self-start bg-ink px-6 py-3 font-mono text-[11px] uppercase tracking-[0.18em] text-canvas">
          Sign in
        </Link>
      </div>
    );
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
      <Field label="New password" id="password" name="password" type="password" autoComplete="new-password" required minLength={12} maxLength={128} hint="At least 12 characters." />
      <Field label="Repeat new password" id="confirm" name="confirm" type="password" autoComplete="new-password" required />
      {error && (
        <p role="alert" className="text-sm text-alert">
          {error}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save password"}
      </Button>
    </form>
  );
}
