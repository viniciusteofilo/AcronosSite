"use client";

import { useState, useTransition } from "react";
import type { ActionResult } from "@/server/admin/errors";
import { Notice, Panel, SaveBar, TextArea, TextInput, dateTime, primaryButton, secondaryButton, smallButton, useUnsavedWarning } from "./ui";

type Section = { heading: string; body: string };
type PageData = {
  slug: string;
  path: string;
  kind: "page" | "policy";
  title: string;
  intro: string;
  sections: Section[];
  status: "draft" | "published";
  seoTitle: string;
  seoDescription: string;
  revisions: { id: string; createdAt: string; author: string | null }[];
};
type Loaded = { title: string; intro: string; sections: Section[]; seoTitle: string; seoDescription: string };

/** About, Lab intro and policies: an intro and titled sections, plain text with line breaks. */
export function PageEditor({
  page,
  actions,
}: {
  page: PageData;
  actions: {
    save: (input: unknown) => Promise<ActionResult<void>>;
    loadRevision: (slug: string, id: string) => Promise<ActionResult<Loaded>>;
  };
}) {
  const [form, setForm] = useState({ title: page.title, intro: page.intro, sections: page.sections, seoTitle: page.seoTitle, seoDescription: page.seoDescription });
  const [status, setStatus] = useState(page.status);
  const [reviewed, setReviewed] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, start] = useTransition();
  useUnsavedWarning(dirty);

  const set = (patch: Partial<typeof form>) => {
    setForm((f) => ({ ...f, ...patch }));
    setDirty(true);
  };
  const setSection = (i: number, patch: Partial<Section>) => set({ sections: form.sections.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  const move = (i: number, to: number) => {
    if (to < 0 || to >= form.sections.length) return;
    const next = [...form.sections];
    const [x] = next.splice(i, 1);
    next.splice(to, 0, x);
    set({ sections: next });
  };

  function save(nextStatus: "draft" | "published") {
    start(async () => {
      const r = await actions.save({ slug: page.slug, ...form, status: nextStatus, legalReviewed: reviewed });
      setNotice(r.ok ? { ok: true, message: nextStatus === "published" ? "Published. The page on the site is updated." : "Saved as draft. The site still shows the previous published text." } : r);
      if (r.ok) {
        setDirty(false);
        setStatus(nextStatus);
      }
    });
  }

  return (
    <div className="flex flex-col gap-6 pb-24">
      <SaveBar status={dirty ? "Unsaved changes" : status === "published" ? "Published" : "Draft · not on the site"} tone={dirty ? "alert" : status === "published" ? "signal" : "muted"}>
        {status === "published" && !dirty && (
          <a href={page.path} target="_blank" rel="noopener" className={secondaryButton}>
            View on site
          </a>
        )}
        <button type="button" disabled={pending} onClick={() => save("draft")} className={secondaryButton}>
          Save draft
        </button>
        <button type="button" disabled={pending} onClick={() => save("published")} className={primaryButton}>
          Publish
        </button>
      </SaveBar>
      <Notice result={notice} />

      {page.kind === "policy" && (
        <div className="flex flex-col gap-3 border border-alert/60 bg-paper p-4 text-sm">
          <p>
            <strong>Legal text.</strong> Paste the text approved by ACRONOS and its lawyer. The site never writes policies by itself; until one is published, the page says it is being finalized.
          </p>
          <label className="flex items-start gap-2">
            <input type="checkbox" checked={reviewed} onChange={(e) => setReviewed(e.target.checked)} className="mt-1" />
            I confirm this text was reviewed and approved for publication.
          </label>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="flex min-w-0 flex-col gap-6">
          <Panel title="Text">
            <TextInput label="Title" value={form.title} max={120} required onChange={(v) => set({ title: v })} />
            <TextArea label="Intro" value={form.intro} max={1200} rows={4} onChange={(v) => set({ intro: v })} hint="First paragraph, shown larger." />
          </Panel>
          {form.sections.map((s, i) => (
            <Panel key={i} title={`Section ${i + 1}`}>
              <TextInput label="Heading" value={s.heading} max={120} onChange={(v) => setSection(i, { heading: v })} />
              <TextArea label="Text" value={s.body} max={8000} rows={8} onChange={(v) => setSection(i, { body: v })} hint="Line breaks are kept. Paste from Word or Google Docs is fine." />
              <div className="flex gap-2">
                <button type="button" className={smallButton} disabled={i === 0} onClick={() => move(i, i - 1)}>
                  Move up
                </button>
                <button type="button" className={smallButton} disabled={i === form.sections.length - 1} onClick={() => move(i, i + 1)}>
                  Move down
                </button>
                <button type="button" className="px-3 font-mono text-[10px] uppercase tracking-[0.14em] text-alert hover:underline" onClick={() => set({ sections: form.sections.filter((_, j) => j !== i) })}>
                  Remove section
                </button>
              </div>
            </Panel>
          ))}
          <button type="button" className={`${secondaryButton} self-start`} disabled={form.sections.length >= 30} onClick={() => set({ sections: [...form.sections, { heading: "", body: "" }] })}>
            + Add section
          </button>
        </div>
        <aside className="flex min-w-0 flex-col gap-6">
          <Panel title="Search engines" note="Optional.">
            <TextInput label="Title in Google" value={form.seoTitle} max={70} onChange={(v) => set({ seoTitle: v })} placeholder={form.title} />
            <TextArea label="Description in Google" value={form.seoDescription} max={170} rows={3} onChange={(v) => set({ seoDescription: v })} />
          </Panel>
          <Panel title="History" note="Every save keeps the previous version.">
            {page.revisions.length === 0 ? (
              <p className="text-xs text-muted">No earlier versions yet.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-line text-xs">
                {page.revisions.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-2 py-2">
                    <span>
                      {dateTime.format(new Date(r.createdAt))}
                      {r.author && <span className="block text-muted">{r.author}</span>}
                    </span>
                    <button
                      type="button"
                      className={smallButton}
                      disabled={pending}
                      onClick={() =>
                        start(async () => {
                          const res = await actions.loadRevision(page.slug, r.id);
                          setNotice(res);
                          if (res.ok && res.data) {
                            setForm(res.data);
                            setDirty(true);
                          }
                        })
                      }
                    >
                      Load
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </aside>
      </div>
    </div>
  );
}
