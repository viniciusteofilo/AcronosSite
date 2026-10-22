"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import type { ActionResult } from "@/app/admin/site/actions";
import type { HomeBlocks } from "@/server/content/home";
import type { MediaView } from "@/server/media/library";
import type { UploadedFilm } from "@/lib/video-frames";
import { FilmSlot } from "./film-slot";
import { ImageSlot } from "./image-slot";
import { MediaLibraryDialog } from "./media-library-dialog";

type Actions = {
  save: (b: HomeBlocks) => Promise<ActionResult>;
  publish: (b: HomeBlocks) => Promise<ActionResult>;
  schedule: (b: HomeBlocks, atIso: string) => Promise<ActionResult>;
  cancelSchedule: () => Promise<ActionResult>;
  discard: () => Promise<ActionResult>;
  restore: (id: string) => Promise<ActionResult>;
  updateMedia: (p: { id: string; alt?: string; focalX?: number; focalY?: number }) => Promise<ActionResult>;
  listMedia: () => Promise<(MediaView & { originalName: string | null })[]>;
};

type ImageKey = "hero" | "featuredCollection" | "lab" | "scifi";

const dt = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });

/**
 * Site editor for the homepage campaign. Works on a draft: visitors only see changes after
 * "Publish now" or at the scheduled time. Every published version is kept in the history.
 */
export function HomeEditor({
  initial,
  initialMedia,
  hasDraft: initialHasDraft,
  scheduledAt: initialScheduledAt,
  revisions,
  products,
  actions,
  initialFilm = null,
}: {
  initialFilm?: UploadedFilm | null;
  initial: HomeBlocks;
  initialMedia: Record<string, MediaView>;
  hasDraft: boolean;
  scheduledAt: string | null;
  revisions: { id: string; createdAt: string }[];
  products: { id: string; name: string }[];
  actions: Actions;
}) {
  const [blocks, setBlocks] = useState<HomeBlocks>(initial);
  const [media, setMedia] = useState<Record<string, MediaView>>(initialMedia);
  const [dirty, setDirty] = useState(false);
  const [hasDraft, setHasDraft] = useState(initialHasDraft);
  const [scheduledAt, setScheduledAt] = useState(initialScheduledAt);
  const [notice, setNotice] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();
  const [libraryFor, setLibraryFor] = useState<ImageKey | null>(null);
  const [when, setWhen] = useState("");
  const [film, setFilm] = useState<UploadedFilm | null>(initialFilm);

  const update = useCallback(<K extends keyof HomeBlocks>(key: K, patch: Partial<HomeBlocks[K]>) => {
    setBlocks((b) => ({ ...b, [key]: { ...b[key], ...patch } }));
    setDirty(true);
  }, []);

  const setImage = (key: ImageKey, m: MediaView | null) => {
    if (m) setMedia((all) => ({ ...all, [m.id]: m }));
    update(key, { imageId: m?.id ?? null } as Partial<HomeBlocks[typeof key]>);
  };

  const run = (fn: () => Promise<ActionResult>, after?: (r: ActionResult) => void) =>
    start(async () => {
      const r = await fn();
      setNotice(r);
      if (r.ok) after?.(r);
    });

  const status = useMemo(() => {
    if (dirty) return { text: "Unsaved changes", tone: "text-alert" };
    if (scheduledAt) return { text: `Scheduled for ${dt.format(new Date(scheduledAt))}`, tone: "text-signal-ink" };
    if (hasDraft) return { text: "Draft saved, not published", tone: "text-ink" };
    return { text: "Everything is live", tone: "text-muted" };
  }, [dirty, scheduledAt, hasDraft]);

  const imageProps = (key: ImageKey) => ({
    media: blocks[key].imageId ? (media[blocks[key].imageId!] ?? null) : null,
    onChange: (m: MediaView | null) => setImage(key, m),
    onPickFromLibrary: () => setLibraryFor(key),
    onUpdateMedia: async (p: { id: string; alt?: string; focalX?: number; focalY?: number }) => {
      const r = await actions.updateMedia(p);
      if (!r.ok) setNotice(r);
    },
  });

  return (
    <div className="flex flex-col gap-8 pb-24">
      <div className="sticky top-0 z-20 -mx-4 flex flex-wrap items-center justify-between gap-3 border-b border-line bg-surface/95 px-4 py-3 backdrop-blur md:-mx-8 md:px-8">
        <p className={`font-mono text-[10px] uppercase tracking-[0.16em] ${status.tone}`} role="status">
          {status.text}
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={pending} onClick={() => run(() => actions.save(blocks), () => { setDirty(false); setHasDraft(true); })} className="h-10 border border-field px-4 font-mono text-[10px] uppercase tracking-[0.14em] hover:border-ink disabled:opacity-50">
            Save draft
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              run(() => actions.save(blocks), () => {
                setDirty(false);
                setHasDraft(true);
                window.open("/admin/site/preview", "_blank", "noopener");
              })
            }
            className="h-10 border border-field px-4 font-mono text-[10px] uppercase tracking-[0.14em] hover:border-ink disabled:opacity-50"
          >
            Preview
          </button>
          <button type="button" disabled={pending} onClick={() => run(() => actions.publish(blocks), () => { setDirty(false); setHasDraft(false); })} className="h-10 bg-ink px-5 font-mono text-[10px] uppercase tracking-[0.14em] text-canvas hover:bg-muted disabled:opacity-50">
            Publish now
          </button>
        </div>
      </div>

      {notice && (
        <p role={notice.ok ? "status" : "alert"} className={`border px-4 py-3 text-sm ${notice.ok ? "border-line bg-surface" : "border-alert text-alert"}`}>
          {notice.message}
        </p>
      )}

      <Section title="0. Campaign film (optional)" note="Opens the homepage with a short film that plays as visitors scroll. Leave empty to start with the main photo.">
        <FilmSlot
          film={film}
          onChange={(f) => {
            setFilm(f);
            update("intro", { sequenceId: f?.id ?? null });
          }}
        />
        {film && <Text label="Caption under the film" value={blocks.intro.caption} max={80} onChange={(v) => update("intro", { caption: v })} />}
      </Section>

      <Section title="1. Main photo and headline" note="The first thing visitors see.">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <ImageSlot label="Main photo" hint="Vertical, at least 1800×2200" ratio="4/5" {...imageProps("hero")} />
          <div className="flex flex-col gap-4">
            <Text label="Small line above the logo" value={blocks.hero.eyebrow} max={60} onChange={(v) => update("hero", { eyebrow: v })} />
            <Text label="Headline" value={blocks.hero.headline} max={80} onChange={(v) => update("hero", { headline: v })} />
            <Text label="Keywords (separate with ·)" value={blocks.hero.tags} max={120} onChange={(v) => update("hero", { tags: v })} />
            <Cta label="Main button" value={blocks.hero.primary} onChange={(v) => update("hero", { primary: v })} />
            <Cta label="Second button" value={blocks.hero.secondary} onChange={(v) => update("hero", { secondary: v })} />
            <Text label="Footnote" value={blocks.hero.footnote} max={80} onChange={(v) => update("hero", { footnote: v })} />
          </div>
        </div>
      </Section>

      <Section title="2. Featured collection" note="Use it for the current drop or campaign.">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <ImageSlot label="Campaign photo" hint="Horizontal, at least 2000×1500" ratio="4/3" {...imageProps("featuredCollection")} />
          <div className="flex flex-col gap-4">
            <Text label="Small line" value={blocks.featuredCollection.eyebrow} max={60} onChange={(v) => update("featuredCollection", { eyebrow: v })} />
            <Text label="Title" value={blocks.featuredCollection.title} max={60} onChange={(v) => update("featuredCollection", { title: v })} />
            <Area label="Text" value={blocks.featuredCollection.text} max={400} onChange={(v) => update("featuredCollection", { text: v })} />
            <Cta label="Button" value={blocks.featuredCollection.cta} onChange={(v) => update("featuredCollection", { cta: v })} />
          </div>
        </div>
      </Section>

      <Section title="3. Featured products" note="Show the newest products automatically, or pick up to 8.">
        <div className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Text label="Small line" value={blocks.featuredProducts.eyebrow} max={60} onChange={(v) => update("featuredProducts", { eyebrow: v })} />
            <Text label="Title" value={blocks.featuredProducts.title} max={60} onChange={(v) => update("featuredProducts", { title: v })} />
          </div>
          <fieldset className="flex flex-wrap gap-6">
            <legend className="sr-only">How to choose products</legend>
            {(
              [
                ["newest", "Newest 4 automatically"],
                ["manual", "I choose the products"],
              ] as const
            ).map(([v, l]) => (
              <label key={v} className="flex items-center gap-2 text-sm">
                <input type="radio" name="fp-mode" checked={blocks.featuredProducts.mode === v} onChange={() => update("featuredProducts", { mode: v })} />
                {l}
              </label>
            ))}
          </fieldset>
          {blocks.featuredProducts.mode === "manual" &&
            (products.length === 0 ? (
              <p className="text-sm text-muted">No published products yet. Add products first.</p>
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2">
                {products.map((p) => {
                  const ids = blocks.featuredProducts.productIds;
                  const pos = ids.indexOf(p.id);
                  return (
                    <li key={p.id}>
                      <label className="flex items-center gap-3 border border-line bg-surface px-3 py-2 text-sm">
                        <input
                          type="checkbox"
                          checked={pos >= 0}
                          disabled={pos < 0 && ids.length >= 8}
                          onChange={() => update("featuredProducts", { productIds: pos >= 0 ? ids.filter((i) => i !== p.id) : [...ids, p.id] })}
                        />
                        <span className="flex-1">{p.name}</span>
                        {pos >= 0 && <span className="font-mono text-[10px] text-muted">#{pos + 1}</span>}
                      </label>
                    </li>
                  );
                })}
              </ul>
            ))}
        </div>
      </Section>

      <Section title="4. Manifesto">
        <div className="flex flex-col gap-4">
          <Text label="Small line" value={blocks.manifesto.eyebrow} max={60} onChange={(v) => update("manifesto", { eyebrow: v })} />
          <Text label="Title" value={blocks.manifesto.title} max={80} onChange={(v) => update("manifesto", { title: v })} />
          <Area label="Text" value={blocks.manifesto.text} max={600} onChange={(v) => update("manifesto", { text: v })} />
        </div>
      </Section>

      {(["lab", "scifi"] as const).map((key, i) => (
        <Section key={key} title={`${5 + i}. ${key === "lab" ? "Acronos Lab" : "Acronos Sci-Fi"}`}>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <ImageSlot label="Photo" hint="Horizontal, at least 1600×1000" ratio="16/10" {...imageProps(key)} />
            <div className="flex flex-col gap-4">
              <Text label="Small line" value={blocks[key].eyebrow} max={60} onChange={(v) => update(key, { eyebrow: v })} />
              <Text label="Title" value={blocks[key].title} max={40} onChange={(v) => update(key, { title: v })} />
              <Text label="Tagline" value={blocks[key].line} max={60} onChange={(v) => update(key, { line: v })} />
              <Area label="Text" value={blocks[key].text} max={300} onChange={(v) => update(key, { text: v })} />
              <Cta label="Button" value={blocks[key].cta} onChange={(v) => update(key, { cta: v })} />
            </div>
          </div>
        </Section>
      ))}

      <Section title="Schedule a campaign" note="Prepare the next campaign now; it goes live by itself at the chosen time.">
        {scheduledAt ? (
          <div className="flex flex-wrap items-center gap-4">
            <p className="text-sm">
              A campaign is scheduled for <strong>{dt.format(new Date(scheduledAt))}</strong>.
            </p>
            <button type="button" disabled={pending} onClick={() => run(actions.cancelSchedule, () => { setScheduledAt(null); setHasDraft(true); window.location.reload(); })} className="h-9 border border-field px-3 font-mono text-[10px] uppercase tracking-[0.14em] hover:border-ink">
              Cancel schedule
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-xs text-muted">
              Go live on (your local time)
              <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className="h-10 border border-field bg-surface px-3 text-sm text-ink" />
            </label>
            <button
              type="button"
              disabled={pending || !when}
              onClick={() => {
                const iso = new Date(when).toISOString();
                run(() => actions.schedule(blocks, iso), () => {
                  setScheduledAt(iso);
                  setDirty(false);
                  setHasDraft(false);
                });
              }}
              className="h-10 bg-ink px-4 font-mono text-[10px] uppercase tracking-[0.14em] text-canvas disabled:opacity-40"
            >
              Schedule these changes
            </button>
          </div>
        )}
      </Section>

      <Section title="History" note="Earlier versions of the homepage. Restoring loads it into the draft; nothing changes until you publish.">
        {revisions.length === 0 ? (
          <p className="text-sm text-muted">No earlier versions yet.</p>
        ) : (
          <ul className="divide-y divide-line border-y border-line">
            {revisions.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-4 py-3 text-sm">
                <span>Live until {dt.format(new Date(r.createdAt))}</span>
                <button type="button" disabled={pending} onClick={() => run(() => actions.restore(r.id), () => window.location.reload())} className="font-mono text-[10px] uppercase tracking-[0.14em] underline underline-offset-4">
                  Restore
                </button>
              </li>
            ))}
          </ul>
        )}
        {hasDraft && !dirty && (
          <button type="button" disabled={pending} onClick={() => run(actions.discard, () => window.location.reload())} className="mt-4 font-mono text-[10px] uppercase tracking-[0.14em] text-alert underline underline-offset-4">
            Discard draft and go back to what is live
          </button>
        )}
      </Section>

      <MediaLibraryDialog
        open={libraryFor !== null}
        onClose={() => setLibraryFor(null)}
        load={actions.listMedia}
        onPick={(m) => libraryFor && setImage(libraryFor, m)}
      />
    </div>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-5 border border-line bg-surface p-5 sm:p-6">
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-sm uppercase tracking-[0.1em]">{title}</h2>
        {note && <p className="text-xs text-muted">{note}</p>}
      </div>
      {children}
    </section>
  );
}

function Text({ label, value, max, onChange }: { label: string; value: string; max: number; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-muted">
      <span className="flex justify-between">
        {label}
        <span className="font-mono text-[10px]">{value.length}/{max}</span>
      </span>
      <input value={value} maxLength={max} onChange={(e) => onChange(e.target.value)} className="h-10 border border-field bg-paper px-3 text-sm text-ink" />
    </label>
  );
}

function Area({ label, value, max, onChange }: { label: string; value: string; max: number; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-muted">
      <span className="flex justify-between">
        {label}
        <span className="font-mono text-[10px]">{value.length}/{max}</span>
      </span>
      <textarea value={value} maxLength={max} rows={4} onChange={(e) => onChange(e.target.value)} className="border border-field bg-paper p-3 text-sm text-ink" />
    </label>
  );
}

function Cta({ label, value, onChange }: { label: string; value: { label: string; href: string }; onChange: (v: { label: string; href: string }) => void }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
      <Text label={`${label}: text (empty hides it)`} value={value.label} max={40} onChange={(v) => onChange({ ...value, label: v })} />
      <label className="flex flex-col gap-1 text-xs text-muted">
        Link (e.g. /shop or /collections/drop-01)
        <input value={value.href} maxLength={300} onChange={(e) => onChange({ ...value, href: e.target.value })} className="h-10 border border-field bg-paper px-3 font-mono text-xs text-ink" />
      </label>
    </div>
  );
}
