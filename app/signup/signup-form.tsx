"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { HumanCheck, humanCheckEnabled } from "@/components/ui/turnstile";
import { authClient } from "@/lib/auth-client";

export function SignupForm({ next }: { next: string }) {
  const router = useRouter();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [human, setHuman] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const found: Record<string, string> = {};
    if (name.length < 2) found.name = "Enter your name.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) found.email = "Enter a valid e-mail address.";
    if (password.length < 12) found.password = "Use at least 12 characters.";
    setErrors(found);
    if (Object.keys(found).length) return;
    if (humanCheckEnabled && !human) return setError("Please complete the check that you are not a robot.");
    setPending(true);
    const { error } = await authClient.signUp.email({ name, email, password, callbackURL: "/account?verified=1" }, { headers: human ? { "x-captcha-response": human } : {} });
    setPending(false);
    if (error) {
      setHuman(null);
      setAttempt((n) => n + 1); // a check token works once
      // the same message for an existing address: the form does not reveal who has an account
      return setError(
        error.status === 429
          ? "Too many attempts. Wait a few minutes and try again."
          : error.code === "PASSWORD_TOO_SHORT" || error.code === "PASSWORD_TOO_LONG"
            ? "Use a password between 12 and 128 characters."
            : "We could not create the account. If you already have one, sign in or reset your password.",
      );
    }
    router.replace(next === "/account" ? "/account?welcome=1" : next);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
      <Field label="Name" id="name" name="name" autoComplete="name" required maxLength={120} error={errors.name} />
      <Field label="Email" id="email" name="email" type="email" autoComplete="email" required maxLength={254} error={errors.email} />
      <Field
        label="Password"
        id="password"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        minLength={12}
        maxLength={128}
        hint="At least 12 characters. A short sentence is easy to remember and hard to guess."
        error={errors.password}
      />
      <p className="text-xs text-muted">
        We will e-mail you a link to confirm the address. See how we use your data in the{" "}
        <Link href="/policies/privacy" className="underline underline-offset-4">
          privacy policy
        </Link>
        .
      </p>
      <HumanCheck action="signup" onToken={setHuman} resetKey={attempt} />
      {error && (
        <p role="alert" className="text-sm text-alert">
          {error}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? "Creating account…" : "Create account"}
      </Button>
    </form>
  );
}
