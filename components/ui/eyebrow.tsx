/** Small mono label used above titles: "01 // COLLECTION". */
export function Eyebrow({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={`font-mono text-[10px] uppercase tracking-[0.22em] text-steel ${className}`}>{children}</p>
  );
}

export function SectionTitle({
  children,
  as: Tag = "h2",
  className = "",
}: {
  children: React.ReactNode;
  as?: "h1" | "h2" | "h3";
  className?: string;
}) {
  return (
    <Tag className={`font-display text-2xl font-medium uppercase tracking-[0.08em] sm:text-3xl ${className}`}>
      {children}
    </Tag>
  );
}
