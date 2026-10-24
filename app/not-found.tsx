import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-24 text-center">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">Error 404</p>
      <h1 className="font-display text-2xl uppercase tracking-[0.08em]">Page not found</h1>
      <Link href="/" className="font-mono text-xs uppercase tracking-[0.12em] text-muted hover:text-ink">
        Back to home
      </Link>
    </main>
  );
}
