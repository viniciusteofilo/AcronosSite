"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { authClient } from "@/lib/auth-client";

export function ForgotForm() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const email = String(new FormData(e.currentTarget).get("email") ?? "").trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setError("Enter a valid e-mail address.");
    setPending(true);
    const { error } = await authClient.requestPasswordReset({ email, redirectTo: "/login/reset" });
    setPending(false);
    if (error?.status === 429) return setError("Too many attempts. Wait a few minutes and try again.");
    setSent(true); // same answer whether or not the address has an account
  }

  if (sent)
    return (
      <p role="status" className="text-sm">
        If there is an account for that address, we sent a link to choose a new password. It works for one hour. Check your spam folder too.
      </p>
    );
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
      <p className="text-sm text-muted">Enter the e-mail of your account and we will send you a link.</p>
      <Field label="Email" id="email" name="email" type="email" autoComplete="email" required error={error ?? undefined} />
      <Button type="submit" disabled={pending}>
        {pending ? "Sending…" : "Send link"}
      </Button>
    </form>
  );
}
