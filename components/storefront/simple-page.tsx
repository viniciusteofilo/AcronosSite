import type { SimplePage } from "@/server/content/pages";

/** Renders an institutional page's intro and sections as plain, readable text. */
export function SimplePageBody({ page }: { page: Pick<SimplePage, "intro" | "sections"> }) {
  return (
    <div className="flex max-w-[68ch] flex-col gap-10 py-12 text-[17px] leading-[1.75] text-ink/90">
      {page.intro && <p className="whitespace-pre-line text-lg">{page.intro}</p>}
      {page.sections.map((s, i) => (
        <section key={i} className="flex flex-col gap-3">
          {s.heading && <h2 className="font-display text-lg uppercase tracking-[0.08em]">{s.heading}</h2>}
          <p className="whitespace-pre-line">{s.body}</p>
        </section>
      ))}
    </div>
  );
}
