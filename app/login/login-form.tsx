"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { authClient } from "@/lib/auth-client";

type Step = "credentials" | "totp" | "backup";

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("credentials");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onCredentials(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const form = new FormData(e.currentTarget);
    const { data, error } = await authClient.signIn.email({
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? ""),
    });
    setPending(false);
    if (error) {
      return setError(
        error.status === 429
          ? "Too many attempts. Wait a minute and try again."
          : "Email or password is incorrect.",
      );
    }
    if (data && "twoFactorRedirect" in data && data.twoFactorRedirect) return setStep("totp");
    router.replace(next);
    router.refresh();
  }

  async function onSecondFactor(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const code = String(new FormData(e.currentTarget).get("code") ?? "").trim();
    const result =
      step === "totp"
        ? await authClient.twoFactor.verifyTotp({ code })
        : await authClient.twoFactor.verifyBackupCode({ code });
    setPending(false);
    if (result.error) {
      return setError(
        result.error.status === 429
          ? "Too many attempts. Wait a minute and try again."
          : "That code is not valid. Try again.",
      );
    }
    router.replace(next);
    router.refresh();
  }

  if (step === "credentials") {
    return (
      <form key="credentials" onSubmit={onCredentials} className="flex flex-col gap-5" noValidate>
        <Field label="Email" id="email" name="email" type="email" autoComplete="email" required />
        <Field
          label="Password"
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
        {error && (
          <p role="alert" className="text-sm text-alert">
            {error}
          </p>
        )}
        <Button type="submit" disabled={pending}>
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    );
  }

  return (
    // `key` forces a fresh form: React must never carry the typed password into the code field.
    <form key={step} onSubmit={onSecondFactor} className="flex flex-col gap-5" noValidate>
      <p className="text-sm text-steel">
        {step === "totp"
          ? "Enter the 6-digit code from your authenticator app."
          : "Enter one of your backup codes."}
      </p>
      <Field
        label={step === "totp" ? "Authentication code" : "Backup code"}
        id="code"
        name="code"
        inputMode={step === "totp" ? "numeric" : "text"}
        autoComplete="one-time-code"
        autoFocus
        required
      />
      {error && (
        <p role="alert" className="text-sm text-alert">
          {error}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? "Verifying…" : "Verify"}
      </Button>
      <button
        type="button"
        className="font-mono text-xs uppercase tracking-[0.12em] text-steel hover:text-snow"
        onClick={() => setStep(step === "totp" ? "backup" : "totp")}
      >
        {step === "totp" ? "Use a backup code instead" : "Use authenticator app"}
      </button>
    </form>
  );
}
