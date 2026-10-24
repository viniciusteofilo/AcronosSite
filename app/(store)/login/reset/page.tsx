import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { LogoLockup } from "@/components/brand/logo";
import { ResetForm } from "./reset-form";

export const metadata: Metadata = { title: "Choose a new password", robots: { index: false } };

export default function ResetPage({ searchParams }: PageProps<"/login/reset">) {
  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-10 px-4 py-16">
      <LogoLockup className="w-44 self-center" />
      <h1 className="font-display text-2xl uppercase tracking-[0.08em]">New password</h1>
      <Suspense fallback={null}>
        <Body searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Body({ searchParams }: Pick<PageProps<"/login/reset">, "searchParams">) {
  const { token, error } = await searchParams;
  if (typeof token !== "string" || !token || error)
    return (
      <p className="text-sm">
        This link is not valid or has expired.{" "}
        <Link href="/login/forgot" className="underline underline-offset-4">
          Ask for a new one
        </Link>
        .
      </p>
    );
  return <ResetForm token={token} />;
}
