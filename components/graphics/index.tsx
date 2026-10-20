/**
 * Graphic elements from the ACRONOS identity board: crosshair, hatch, globe, signal mark,
 * corner brackets, hazard stripe and angled rule. All decorative (aria-hidden).
 */
type G = { className?: string };
const base = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.25,
  "aria-hidden": true,
} as const;

export const Crosshair = ({ className }: G) => (
  <svg viewBox="0 0 48 48" className={className} {...base}>
    <path d="M24 4v40M4 24h40" />
    <path d="M18 24h12M24 18v12" strokeWidth={2} />
  </svg>
);

export const Hatch = ({ className }: G) => (
  <svg viewBox="0 0 48 48" className={className} {...base} strokeWidth={3}>
    <path d="M10 42L22 6M20 42L32 6M30 42L42 6" />
  </svg>
);

export const Globe = ({ className }: G) => (
  <svg viewBox="0 0 48 48" className={className} {...base} strokeWidth={1}>
    <circle cx="24" cy="24" r="19" />
    <ellipse cx="24" cy="24" rx="8" ry="19" />
    <ellipse cx="24" cy="24" rx="14" ry="19" />
    <path d="M5 24h38M8 14h32M8 34h32" />
  </svg>
);

export const SignalMark = ({ className }: G) => (
  <svg viewBox="0 0 48 48" className={className} {...base}>
    <circle cx="24" cy="24" r="19" />
    <path d="M24 15l2.6 6.4L33 24l-6.4 2.6L24 33l-2.6-6.4L15 24l6.4-2.6z" fill="currentColor" stroke="none" />
  </svg>
);

export const CornerBrackets = ({ className }: G) => (
  <svg viewBox="0 0 48 48" className={className} {...base} strokeWidth={2}>
    <path d="M4 14V4h10M34 4h10v10M44 34v10H34M14 44H4V34" />
  </svg>
);

export const HazardStripe = ({ className }: G) => (
  <svg viewBox="0 0 12 48" className={className} {...base} strokeWidth={2.5}>
    <path d="M1 8l10-6M1 18l10-6M1 28l10-6M1 38l10-6M1 48l10-6" />
  </svg>
);

export const AngleRule = ({ className }: G) => (
  <svg viewBox="0 0 120 24" className={className} {...base} preserveAspectRatio="none">
    <path d="M0 4h84l20 18h16" />
  </svg>
);

/** Thin frame with corner brackets, used to mark media slots and focus areas. */
export function BracketFrame({ className = "" }: G) {
  return (
    <span aria-hidden className={`pointer-events-none absolute inset-3 ${className}`}>
      <span className="absolute left-0 top-0 h-3 w-3 border-l border-t border-current" />
      <span className="absolute right-0 top-0 h-3 w-3 border-r border-t border-current" />
      <span className="absolute bottom-0 left-0 h-3 w-3 border-b border-l border-current" />
      <span className="absolute bottom-0 right-0 h-3 w-3 border-b border-r border-current" />
    </span>
  );
}
