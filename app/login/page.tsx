import type { Metadata } from "next";
import { Suspense } from "react";
import { LogoLockup } from "@/components/brand/logo";
import { safeNextPath } from "@/lib/safe-redirect";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-10 px-4 py-16">
      <LogoLockup className="w-44 self-center" />
      <h1 className="font-display text-2xl uppercase tracking-[0.08em]">Sign in</h1>
      <Suspense fallback={null}>
        <LoginFormWithNext searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function LoginFormWithNext({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  const { next } = await searchParams;
  return <LoginForm next={safeNextPath(next)} />;
}
