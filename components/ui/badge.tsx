type Tone = "neutral" | "signal" | "alert" | "inverse";

const tones: Record<Tone, string> = {
  neutral: "border-concrete text-steel",
  signal: "border-signal/60 text-signal",
  alert: "border-alert/70 text-alert",
  inverse: "border-snow bg-snow text-void",
};

/** Status label. Meaning is always in the text, never in color alone. */
export function Badge({ tone = "neutral", children }: { tone?: Tone; children: React.ReactNode }) {
  return (
    <span className={`inline-flex h-6 items-center border px-2 font-mono text-[10px] uppercase tracking-[0.14em] ${tones[tone]}`}>
      {children}
    </span>
  );
}
