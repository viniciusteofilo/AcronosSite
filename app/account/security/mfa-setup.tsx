"use client";

import QRCode from "qrcode";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { authClient } from "@/lib/auth-client";

type Setup = { qrDataUrl: string; uri: string; backupCodes: string[] };

/** Enables TOTP two-factor: confirm password, scan the QR code, verify one code. */
export function MfaSetup({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [setup, setSetup] = useState<Setup | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(enabled);
  const [pending, setPending] = useState(false);

  async function start(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const password = String(new FormData(e.currentTarget).get("password") ?? "");
    const { data, error } = await authClient.twoFactor.enable({ password, method: "totp" });
    setPending(false);
    if (error || !data || data.method !== "totp") return setError("Password is incorrect.");
    const qrDataUrl = await QRCode.toDataURL(data.totpURI, { margin: 1, width: 220 });
    setSetup({ qrDataUrl, uri: data.totpURI, backupCodes: data.backupCodes });
  }

  async function verify(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const code = String(new FormData(e.currentTarget).get("code") ?? "").trim();
    const { error } = await authClient.twoFactor.verifyTotp({ code });
    setPending(false);
    if (error) return setError("That code is not valid. Check the time on your phone and try again.");
    setDone(true);
    router.refresh();
  }

  if (done) {
    return (
      <p className="border border-concrete p-4 text-sm">
        Two-factor authentication is <strong>on</strong> for this account.
      </p>
    );
  }

  if (!setup) {
    return (
      <form onSubmit={start} className="flex flex-col gap-5">
        <p className="text-sm text-steel">
          Confirm your password to start. You will need an authenticator app such as Google
          Authenticator, Microsoft Authenticator or 1Password.
        </p>
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
          Set up two-factor
        </Button>
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <p className="text-sm text-steel">1. Scan this code with your authenticator app.</p>
        {/* eslint-disable-next-line @next/next/no-img-element -- generated data URL */}
        <img src={setup.qrDataUrl} alt="QR code for your authenticator app" width={220} height={220} />
        <details className="text-xs text-steel">
          <summary className="cursor-pointer">Can’t scan? Show the setup key</summary>
          <code className="mt-2 block break-all font-mono">{setup.uri}</code>
        </details>
      </div>
      <div className="flex flex-col gap-3">
        <p className="text-sm text-steel">
          2. Save these backup codes somewhere safe. Each one works once if you lose your phone.
        </p>
        <ul className="grid grid-cols-2 gap-2 border border-concrete p-4 font-mono text-sm">
          {setup.backupCodes.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      </div>
      <form onSubmit={verify} className="flex flex-col gap-5">
        <Field
          label="3. Enter the 6-digit code"
          id="code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          required
        />
        {error && (
          <p role="alert" className="text-sm text-alert">
            {error}
          </p>
        )}
        <Button type="submit" disabled={pending}>
          Turn on two-factor
        </Button>
      </form>
    </div>
  );
}
