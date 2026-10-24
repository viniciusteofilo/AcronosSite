import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { LogoLockup } from "@/components/brand/logo";
import { safeNextPath } from "@/lib/safe-redirect";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-10 px-4 py-16">
      <LogoLockup className="w-44 self-center" />
      <h1 className="font-display text-2xl uppercase tracking-[0.08em]">Sign in</h1>
      <Suspense fallback={null}>
        <LoginFormWithNext searchParams={searchParams} />
      </Suspense>
      <div className="flex flex-col gap-3 text-sm text-muted">
        <Link href="/login/forgot" className="self-start underline underline-offset-4 hover:text-ink">
          Forgot your password?
        </Link>
        <p>
          New to ACRONOS?{" "}
          <Link href="/signup" className="text-ink underline underline-offset-4">
            Create account
          </Link>
        </p>
      </div>
    </div>
  );
}

async function LoginFormWithNext({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  const { next } = await searchParams;
  return <LoginForm next={safeNextPath(next)} />;
}
