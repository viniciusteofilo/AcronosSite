"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { slugify } from "@/lib/slug";
import type { ActionResult } from "@/server/admin/errors";
import type { EditorCollection } from "@/server/catalog/collections-admin";
import type { MediaView } from "@/server/media/library";
import { ImageSlot } from "./image-slot";
import { MediaLibraryDialog } from "./media-library-dialog";
import { Notice, Panel, SaveBar, StatusBadge, TextArea, TextInput, dangerButton, inputClass, primaryButton, secondaryButton, smallButton, useUnsavedWarning } from "./ui";

type Choice = { id: string; name: string; status: string; image: MediaView | null };
type Status = EditorCollection["status"];

/** A drop or campaign: banner photo, text, and the products in the order shown. */
export function CollectionEditor({
  initial,
  products,
  canEdit,
  actions,
}: {
  initial: EditorCollection | null;
  products: Choice[];
  canEdit: boolean;
  actions: {
    save: (input: unknown) => Promise<ActionResult<{ id: string; slug: string }>>;
    remove: (id: string) => Promise<ActionResult<void>>;
    updateMedia: (p: { id: string; alt?: string; focalX?: number; focalY?: number }) => Promise<{ ok: boolean; message: string }>;
    listMedia: () => Promise<(MediaView & { originalName: string | null })[]>;
  };
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    id: initial?.id ?? null,
    name: initial?.name ?? "",
    slug: initial?.slug ?? "",
    slugTouched: Boolean(initial),
    description: initial?.description ?? "",
    status: (initial?.status ?? "draft") as Status,
    seoTitle: initial?.seoTitle ?? "",
    seoDescription: initial?.seoDescription ?? "",
  });
  const [hero, setHero] = useState<MediaView | null>(initial?.hero ?? null);
  const [selected, setSelected] = useState<string[]>(initial?.productIds ?? []);
  const [query, setQuery] = useState("");
  const [dirty, setDirty] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, start] = useTransition();
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  useUnsavedWarning(dirty);

  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const set = (patch: Partial<typeof form>) => {
    setForm((f) => {
      const next = { ...f, ...patch };
      if (patch.name !== undefined && !f.slugTouched) next.slug = slugify(patch.name);
      if (patch.slug !== undefined) next.slugTouched = true;
      return next;
    });
    setDirty(true);
  };
  const move = (i: number, to: number) => {
    if (to < 0 || to >= selected.length) return;
    const next = [...selected];
    const [x] = next.splice(i, 1);
    next.splice(to, 0, x);
    setSelected(next);
    setDirty(true);
  };
  const available = products.filter((p) => !selected.includes(p.id) && p.name.toLowerCase().includes(query.trim().toLowerCase()));

  function save(status?: Status) {
    start(async () => {
      const r = await actions.save({
        id: form.id ?? undefined,
        name: form.name,
        slug: form.slug,
        description: form.description,
        heroImageId: hero?.id ?? null,
        status: status ?? form.status,
        seoTitle: form.seoTitle,
        seoDescription: form.seoDescription,
        productIds: selected,
      });
      setNotice(r);
      if (!r.ok || !r.data) return;
      setDirty(false);
      if (status) setForm((f) => ({ ...f, status }));
      if (!form.id) router.replace(`/admin/collections/${r.data.id}`);
    });
  }

  return (
    <div className="flex flex-col gap-6 pb-24">
      <SaveBar status={dirty ? "Unsaved changes" : form.id ? `${form.status} · saved` : "New collection · not saved yet"} tone={dirty ? "alert" : form.status === "published" ? "signal" : "muted"}>
        {form.id && form.status === "published" && !dirty && (
          <a href={`/collections/${form.slug}`} target="_blank" rel="noopener" className={secondaryButton}>
            View on site
          </a>
        )}
        {canEdit && (
          <>
            <button type="button" disabled={pending} onClick={() => save()} className={secondaryButton}>
              {pending ? "Saving…" : "Save"}
            </button>
            {form.status !== "published" && (
              <button type="button" disabled={pending} onClick={() => save("published")} className={primaryButton}>
                Save and publish
              </button>
            )}
          </>
        )}
      </SaveBar>
      <Notice result={notice} />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-6">
          <Panel title="Collection">
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
              <ImageSlot
                label="Banner photo"
                hint="Horizontal 16:9, at least 2400×1350"
                ratio="16/9"
                media={hero}
                onChange={(m) => {
                  setHero(m);
                  setDirty(true);
                }}
                onPickFromLibrary={() => setLibraryOpen(true)}
                onUpdateMedia={async (p) => {
                  const r = await actions.updateMedia(p);
                  if (!r.ok) setNotice(r);
                }}
              />
              <div className="flex flex-col gap-4">
                <TextInput label="Name" required value={form.name} max={80} onChange={(v) => set({ name: v })} placeholder="e.g. Drop 01 — Concrete Signal" />
                <TextInput label="Web address" mono value={form.slug} max={80} onChange={(v) => set({ slug: v.toLowerCase() })} hint={`acronos.com/collections/${form.slug || "…"}`} />
                <TextArea label="Text" value={form.description} max={1200} rows={5} onChange={(v) => set({ description: v })} />
              </div>
            </div>
          </Panel>

          <Panel title={`Products (${selected.length})`} note="Shown on the collection page in this order. Only published products appear to visitors.">
            {selected.length > 0 ? (
              <ol className="flex flex-col divide-y divide-line border border-line bg-paper">
                {selected.map((id, i) => {
                  const p = byId.get(id);
                  return (
                    <li key={id} className="flex items-center gap-3 px-3 py-2">
                      <span className="w-6 font-mono text-[10px] text-muted">{String(i + 1).padStart(2, "0")}</span>
                      <Thumb media={p?.image ?? null} />
                      <span className="min-w-0 flex-1 truncate text-sm">{p?.name ?? "Deleted product"}</span>
                      {p && p.status !== "published" && <StatusBadge status={p.status} />}
                      <button type="button" aria-label={`Move ${p?.name} up`} disabled={i === 0} onClick={() => move(i, i - 1)} className="px-2 font-mono text-xs text-muted hover:text-ink disabled:opacity-30">
                        ↑
                      </button>
                      <button type="button" aria-label={`Move ${p?.name} down`} disabled={i === selected.length - 1} onClick={() => move(i, i + 1)} className="px-2 font-mono text-xs text-muted hover:text-ink disabled:opacity-30">
                        ↓
                      </button>
                      <button
                        type="button"
                        aria-label={`Remove ${p?.name} from collection`}
                        onClick={() => {
                          setSelected(selected.filter((x) => x !== id));
                          setDirty(true);
                        }}
                        className="px-2 font-mono text-xs text-muted hover:text-alert"
                      >
                        ×
                      </button>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p className="text-sm text-muted">No products yet. Add them from the list below.</p>
            )}
            <div className="flex flex-col gap-2">
              <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a product to add" aria-label="Find a product to add" className={inputClass} />
              <ul className="max-h-72 overflow-y-auto border border-line">
                {available.slice(0, 100).map((p) => (
                  <li key={p.id} className="flex items-center gap-3 border-b border-line px-3 py-2 last:border-b-0">
                    <Thumb media={p.image} />
                    <span className="min-w-0 flex-1 truncate text-sm">{p.name}</span>
                    {p.status !== "published" && <StatusBadge status={p.status} />}
                    <button
                      type="button"
                      onClick={() => {
                        setSelected([...selected, p.id]);
                        setDirty(true);
                      }}
                      className={smallButton}
                    >
                      Add
                    </button>
                  </li>
                ))}
                {available.length === 0 && <li className="px-3 py-3 text-sm text-muted">{products.length === 0 ? "No products yet." : "Nothing else to add."}</li>}
              </ul>
            </div>
          </Panel>
        </div>

        <aside className="flex min-w-0 flex-col gap-6">
          <Panel title="Visibility">
            {(["draft", "published", "archived"] as Status[]).map((s) => (
              <label key={s} className={`flex cursor-pointer gap-3 border p-3 text-sm ${form.status === s ? "border-ink bg-paper" : "border-line"}`}>
                <input type="radio" name="collection-status" checked={form.status === s} onChange={() => set({ status: s })} className="mt-1" />
                <span className="flex flex-col">
                  <span className="capitalize">{s}</span>
                  <span className="text-xs text-muted">
                    {s === "draft" ? "Only visible here." : s === "published" ? "Listed on the Collections page." : "Hidden; products are not affected."}
                  </span>
                </span>
              </label>
            ))}
          </Panel>
          <Panel title="Search engines" note="Optional.">
            <TextInput label="Title in Google" value={form.seoTitle} max={70} onChange={(v) => set({ seoTitle: v })} placeholder={form.name} />
            <TextArea label="Description in Google" value={form.seoDescription} max={170} rows={3} onChange={(v) => set({ seoDescription: v })} />
          </Panel>
          {form.id && canEdit && (
            <Panel title="More">
              {confirmDelete ? (
                <div className="flex flex-col gap-2 border border-alert p-3 text-xs">
                  <p>Delete this collection? Its products are kept.</p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="h-9 bg-alert px-3 font-mono text-[10px] uppercase tracking-[0.14em] text-paper"
                      onClick={() =>
                        start(async () => {
                          const r = await actions.remove(form.id!);
                          setNotice(r);
                          if (r.ok) {
                            setDirty(false);
                            router.push("/admin/collections");
                          }
                        })
                      }
                    >
                      Yes, delete
                    </button>
                    <button type="button" onClick={() => setConfirmDelete(false)} className={smallButton}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button type="button" onClick={() => setConfirmDelete(true)} className={dangerButton}>
                  Delete collection
                </button>
              )}
            </Panel>
          )}
        </aside>
      </div>
      <MediaLibraryDialog
        open={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        load={actions.listMedia}
        onPick={(m) => {
          setHero(m);
          setDirty(true);
        }}
      />
    </div>
  );
}

function Thumb({ media }: { media: MediaView | null }) {
  return (
    <span className="block aspect-[4/5] w-8 shrink-0 overflow-hidden border border-line bg-canvas">
      {media && (
        // eslint-disable-next-line @next/next/no-img-element -- admin thumbnail
        <img src={media.src} srcSet={media.srcSet} sizes="32px" alt="" className="h-full w-full object-cover" />
      )}
    </span>
  );
}
