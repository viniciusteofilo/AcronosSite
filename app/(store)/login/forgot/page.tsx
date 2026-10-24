import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { LogoLockup } from "@/components/brand/logo";
import { emailAvailable } from "@/server/email/send";
import { ForgotForm } from "./forgot-form";

export const metadata: Metadata = { title: "Reset password", robots: { index: false } };

export default function ForgotPage() {
  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-10 px-4 py-16">
      <LogoLockup className="w-44 self-center" />
      <h1 className="font-display text-2xl uppercase tracking-[0.08em]">Reset password</h1>
      <Suspense fallback={null}>
        <Body />
      </Suspense>
      <Link href="/login" className="font-mono text-xs uppercase tracking-[0.12em] text-muted hover:text-ink">
        ← Back to sign in
      </Link>
    </div>
  );
}

async function Body() {
  await connection();
  if (!emailAvailable())
    return (
      <p className="text-sm">
        Password reset by e-mail is not available yet. Write to us from the{" "}
        <Link href="/contact" className="underline underline-offset-4">
          contact page
        </Link>{" "}
        and we will help you.
      </p>
    );
  return <ForgotForm />;
}
