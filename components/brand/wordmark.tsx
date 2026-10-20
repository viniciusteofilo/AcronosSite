import { LogoWordmark } from "./logo";

/**
 * Official ACRONOS wordmark (traced from the supplied artwork, see logo.tsx).
 * Sized by font size: pass a text-* class and the mark scales with it.
 */
export function Wordmark({ className = "" }: { className?: string }) {
  return <LogoWordmark className={`inline-block h-[0.85em] w-auto ${className}`} />;
}
