import Link from "next/link";
import { LogoLockup } from "@/components/brand/logo";

// Phase 01 placeholder. The editorial homepage is built in Phase 03 (storefront).
export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-10 px-4 py-24 text-center">
      <h1 className="sr-only">ACRONOS. Future observed from everyday chaos.</h1>
      <LogoLockup className="w-72 sm:w-96" />
      <p className="max-w-md text-muted">
        Our new online store is under construction.
      </p>
      <Link
        href="/login"
        className="font-mono text-xs uppercase tracking-[0.12em] text-muted underline-offset-4 hover:text-ink hover:underline"
      >
        Account sign in
      </Link>
    </main>
  );
}
