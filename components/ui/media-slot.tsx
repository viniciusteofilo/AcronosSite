import { BracketFrame } from "@/components/graphics";

/**
 * Stand-in for a real photograph until the official images are supplied.
 * It is labeled as a slot (with the recommended size) so it is never mistaken
 * for final content. Replace with next/image once photos exist.
 *
 * `fill` covers the nearest positioned parent (hero and banner backgrounds);
 * otherwise the slot keeps its own aspect ratio.
 */
export function MediaSlot({
  label,
  ratio = "4/5",
  tone = "dark",
  fill = false,
  className = "",
}: {
  label: string;
  ratio?: string;
  tone?: "dark" | "light";
  fill?: boolean;
  className?: string;
}) {
  const dark = tone === "dark";
  return (
    <div
      role="img"
      aria-label={`Image placeholder: ${label}`}
      style={fill ? undefined : { aspectRatio: ratio }}
      className={`${fill ? "absolute inset-0" : "relative"} overflow-hidden ${
        dark
          ? "bg-[linear-gradient(140deg,#3a3a3a_0%,#1b1b1b_40%,#2c2c2c_100%)] text-snow/45"
          : "bg-[linear-gradient(160deg,#ececec_0%,#d9d9d9_100%)] text-void/35"
      } ${className}`}
    >
      {dark ? (
        <svg aria-hidden viewBox="0 0 400 500" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full">
          <path d="M0 500L0 330L150 90L240 140L240 500z" fill="#262626" />
          <path d="M150 90L240 140L240 500" fill="none" stroke="#4a4a4a" strokeWidth="1" />
          <path d="M270 500L270 40L400 0L400 500z" fill="#1a1a1a" />
          <path d="M270 40L400 0" stroke="#555" strokeWidth="1" />
          <path d="M0 330L150 90" stroke="#4a4a4a" strokeWidth="1" />
        </svg>
      ) : (
        <svg aria-hidden viewBox="0 0 400 500" preserveAspectRatio="xMidYMid meet" className="absolute inset-0 h-full w-full">
          <path d="M150 120l50-20 50 20 30 70-20 10v200H140V200l-20-10z" fill="#c9c9c9" />
        </svg>
      )}
      <BracketFrame />
      <span className="absolute bottom-4 left-4 font-mono text-[10px] uppercase tracking-[0.18em]">{label}</span>
    </div>
  );
}
