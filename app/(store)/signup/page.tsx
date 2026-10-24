import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { LogoLockup } from "@/components/brand/logo";
import { safeNextPath } from "@/lib/safe-redirect";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = { title: "Create account", robots: { index: false } };

export default function SignupPage({ searchParams }: PageProps<"/signup">) {
  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-10 px-4 py-16">
      <LogoLockup className="w-44 self-center" />
      <h1 className="font-display text-2xl uppercase tracking-[0.08em]">Create account</h1>
      <Suspense fallback={null}>
        <WithNext searchParams={searchParams} />
      </Suspense>
      <p className="text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="text-ink underline underline-offset-4">
          Sign in
        </Link>
      </p>
    </div>
  );
}

async function WithNext({ searchParams }: Pick<PageProps<"/signup">, "searchParams">) {
  const { next } = await searchParams;
  return <SignupForm next={safeNextPath(next)} />;
}
