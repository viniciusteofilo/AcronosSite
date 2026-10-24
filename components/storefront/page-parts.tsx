import { CornerBrackets } from "@/components/graphics";
import { Eyebrow } from "@/components/ui/eyebrow";

export function PageHeader({
  eyebrow,
  title,
  intro,
  children,
}: {
  eyebrow: string;
  title: string;
  intro?: string | null;
  children?: React.ReactNode;
}) {
  return (
    <header className="grid gap-6 border-b border-line py-12 lg:grid-cols-[1fr_auto] lg:items-end lg:py-16">
      <div className="flex flex-col gap-4">
        <Eyebrow>{eyebrow}</Eyebrow>
        <h1 className="font-display text-3xl uppercase tracking-[0.08em] sm:text-5xl">{title}</h1>
        {intro && <p className="max-w-xl whitespace-pre-line text-muted">{intro}</p>}
        {children}
      </div>
      <CornerBrackets className="hidden h-12 w-12 text-ink/25 lg:block" />
    </header>
  );
}

/** Shown wherever ACRONOS has not published content yet. States what will appear, invents nothing. */
export function EmptyState({ title, text, children }: { title: string; text?: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-4 border border-dashed border-line bg-surface/60 px-6 py-16 text-center">
      <p className="font-display text-lg uppercase tracking-[0.08em]">{title}</p>
      {text && <p className="max-w-md text-sm text-muted">{text}</p>}
      {children}
    </div>
  );
}

export function Container({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-[1440px] px-4 sm:px-8 ${className}`}>{children}</div>;
}

export function GridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <ul aria-hidden className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: count }, (_, i) => (
        <li key={i} className="flex flex-col gap-3">
          <div className="aspect-[4/5] animate-pulse bg-line/40" />
          <div className="h-3 w-2/3 bg-line/50" />
        </li>
      ))}
    </ul>
  );
}
