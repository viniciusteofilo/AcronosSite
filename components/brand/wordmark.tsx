/**
 * Text placeholder for the logo. BLOCKED: replace with the official SVG files
 * (symbol, wordmark, signature) when supplied. Do not redraw the logo here.
 */
export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`font-display text-lg font-semibold tracking-[0.3em] ${className}`}>
      ACRONOS
    </span>
  );
}
