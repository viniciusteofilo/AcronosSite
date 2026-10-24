import Link from "next/link";
import { Wordmark } from "@/components/brand/wordmark";

// Phase 01 placeholder. The editorial homepage is built in Phase 03 (storefront).
export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-10 px-4 py-24 text-center">
      <Wordmark className="text-2xl" />
      <h1 className="font-display text-3xl font-semibold uppercase leading-tight tracking-[0.08em] sm:text-5xl">
        Future observed
        <br />
        from everyday chaos.
      </h1>
      <p className="max-w-md text-steel">
        Our new online store is under construction.
      </p>
      <Link
        href="/login"
        className="font-mono text-xs uppercase tracking-[0.12em] text-steel underline-offset-4 hover:text-snow hover:underline"
      >
        Account sign in
      </Link>
    </main>
  );
}
