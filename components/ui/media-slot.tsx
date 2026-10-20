import { BracketFrame } from "@/components/graphics";

/**
 * Stand-in for a real photograph until the official images are supplied.
 * Labeled as a slot (with the recommended size) so it is never mistaken for final content.
 * Phase 07: replaced by next/image fed from the media library; layouts do not change.
 *
 * tone "editorial" = campaign/architecture photos; "product" = packshots on a light ground.
 * `fill` covers the nearest positioned parent; otherwise the slot keeps its aspect ratio.
 */
export function MediaSlot({
  label,
  ratio = "4/5",
  tone = "editorial",
  fill = false,
  className = "",
}: {
  label: string;
  ratio?: string;
  tone?: "editorial" | "product";
  fill?: boolean;
  className?: string;
}) {
  const editorial = tone === "editorial";
  return (
    <div
      role="img"
      aria-label={`Image placeholder: ${label}`}
      style={fill ? undefined : { aspectRatio: ratio }}
      className={`${fill ? "absolute inset-0" : "relative max-w-full"} overflow-hidden text-muted ${
        editorial
          ? "bg-[linear-gradient(150deg,#d9d9d5_0%,#c6c6c1_55%,#d3d3cf_100%)]"
          : "bg-[linear-gradient(170deg,#f4f4f2_0%,#e4e4e0_100%)]"
      } ${className}`}
    >
      {editorial ? (
        <svg aria-hidden viewBox="0 0 400 500" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full">
          <path d="M0 500L0 330L150 90L240 140L240 500z" fill="#bdbdb8" />
          <path d="M270 500L270 40L400 0L400 500z" fill="#b2b2ad" />
          <path d="M0 330L150 90L240 140" fill="none" stroke="#a6a6a1" strokeWidth="1" />
          <path d="M270 40L400 0" stroke="#a6a6a1" strokeWidth="1" />
        </svg>
      ) : (
        <svg aria-hidden viewBox="0 0 400 500" preserveAspectRatio="xMidYMid meet" className="absolute inset-0 h-full w-full">
          <path d="M150 120l50-20 50 20 30 70-20 10v200H140V200l-20-10z" fill="#d2d2ce" />
        </svg>
      )}
      <BracketFrame />
      <span className="absolute bottom-4 left-4 font-mono text-[10px] uppercase tracking-[0.18em]">{label}</span>
    </div>
  );
}
