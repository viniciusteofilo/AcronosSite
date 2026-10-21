"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { slugify } from "@/lib/slug";
import type { ActionResult } from "@/server/admin/errors";
import type { EditorStory } from "@/server/content/stories-admin";
import type { MediaView } from "@/server/media/library";
import { ImageSlot } from "./image-slot";
import { MediaLibraryDialog } from "./media-library-dialog";
import { RichText } from "./rich-text";
import { Notice, Panel, SaveBar, TextArea, TextInput, dangerButton, dateTime, inputClass, isoToLocalInput, localInputToIso, primaryButton, secondaryButton, smallButton, useUnsavedWarning } from "./ui";

type Status = EditorStory["status"];
const STATUS: Record<Status, string> = {
  draft: "Draft — only visible here",
  scheduled: "Scheduled — appears at the date below",
  published: "Published — in the Sci-Fi library",
  archived: "Archived — hidden",
};

/** ACRONOS Sci-Fi story: cover, text with basic formatting, author, schedule and history. */
export function StoryEditor({
  story: initial,
  categories: initialCategories,
  actions,
}: {
  story: EditorStory | null;
  categories: { id: string; name: string }[];
  actions: {
    save: (input: unknown) => Promise<ActionResult<{ id: string; slug: string; story: EditorStory | null }>>;
    remove: (id: string) => Promise<ActionResult<void>>;
    loadRevision: (storyId: string, revisionId: string) => Promise<ActionResult<{ title: string; authorName: string; synopsis: string; body: string }>>;
    createCategory: (input: unknown) => Promise<ActionResult<{ id: string; name: string; slug: string }>>;
    updateMedia: (p: { id: string; alt?: string; focalX?: number; focalY?: number }) => Promise<{ ok: boolean; message: string }>;
    listMedia: () => Promise<(MediaView & { originalName: string | null })[]>;
  };
}) {
  const router = useRouter();
  // unique per instance: Next keeps hidden copies of visited pages, and radios sharing a name would interfere
  const radioName = useId();
  const [story, setStory] = useState(initial);
  const init = (s: EditorStory | null) => ({
    title: s?.title ?? "",
    slug: s?.slug ?? "",
    slugTouched: Boolean(s),
    authorName: s?.authorName ?? "ACRONOS",
    synopsis: s?.synopsis ?? "",
    body: s?.body ?? "",
    status: (s?.status ?? "draft") as Status,
    publishAt: isoToLocalInput(s?.publishAt ?? null),
    categoryIds: s?.categoryIds ?? [],
    importedFrom: s?.importedFrom ?? "",
    seoTitle: s?.seoTitle ?? "",
    seoDescription: s?.seoDescription ?? "",
  });
  const [form, setForm] = useState(() => init(initial));
  const [cover, setCover] = useState<MediaView | null>(initial?.cover ?? null);
  const [bodyKey, setBodyKey] = useState(initial?.updatedAt ?? "new");
  const [categories, setCategories] = useState(initialCategories);
  const [newCat, setNewCat] = useState("");
  const [dirty, setDirty] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, start] = useTransition();
  const [library, setLibrary] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  useUnsavedWarning(dirty);

  const set = (patch: Partial<typeof form>) => {
    setForm((f) => {
      const next = { ...f, ...patch };
      if (patch.title !== undefined && !f.slugTouched) next.slug = slugify(patch.title);
      if (patch.slug !== undefined) next.slugTouched = true;
      return next;
    });
    setDirty(true);
  };

  function save(status?: Status) {
    start(async () => {
      const r = await actions.save({
        id: story?.id,
        expectedUpdatedAt: story?.updatedAt,
        title: form.title,
        slug: form.slug,
        authorName: form.authorName,
        synopsis: form.synopsis,
        coverImageId: cover?.id ?? null,
        body: form.body,
        status: status ?? form.status,
        publishAt: localInputToIso(form.publishAt),
        categoryIds: form.categoryIds,
        importedFrom: form.importedFrom,
        seoTitle: form.seoTitle,
        seoDescription: form.seoDescription,
      });
      setNotice(r);
      if (!r.ok || !r.data) return;
      setDirty(false);
      if (!story) {
        router.replace(`/admin/sci-fi/${r.data.id}`);
        return;
      }
      if (r.data.story) {
        setStory(r.data.story);
        setForm(init(r.data.story));
        setBodyKey(r.data.story.updatedAt);
      }
    });
  }

  const live = story && (story.status === "published" || (story.status === "scheduled" && story.publishAt && new Date(story.publishAt) <= new Date()));

  return (
    <div className="flex flex-col gap-6 pb-24">
      <SaveBar
        status={dirty ? "Unsaved changes" : story ? (story.status === "scheduled" && story.publishAt ? `Scheduled · ${dateTime.format(new Date(story.publishAt))}` : story.status) : "New story · not saved yet"}
        tone={dirty ? "alert" : live ? "signal" : "muted"}
      >
        {live && !dirty && (
          <a href={`/sci-fi/${story!.slug}`} target="_blank" rel="noopener" className={secondaryButton}>
            Read on site
          </a>
        )}
        <button type="button" disabled={pending} onClick={() => save()} className={secondaryButton}>
          {pending ? "Saving…" : "Save"}
        </button>
        {form.status !== "published" && (
          <button type="button" disabled={pending} onClick={() => save("published")} className={primaryButton}>
            Save and publish
          </button>
        )}
      </SaveBar>
      <Notice result={notice} />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-6">
          <Panel title="Story">
            <TextInput label="Title" required value={form.title} max={160} onChange={(v) => set({ title: v })} />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextInput label="Author" required value={form.authorName} max={120} onChange={(v) => set({ authorName: v })} />
              <TextInput label="Web address" mono value={form.slug} max={80} onChange={(v) => set({ slug: v.toLowerCase() })} hint={`/sci-fi/${form.slug || "…"}`} />
            </div>
            <TextArea label="Synopsis" value={form.synopsis} max={600} rows={3} onChange={(v) => set({ synopsis: v })} hint="Shown on the library card and in Google." />
            <RichText label="Text" value={form.body} resetKey={bodyKey} onChange={(html) => set({ body: html })} />
          </Panel>
        </div>
        <aside className="flex min-w-0 flex-col gap-6">
          <Panel title="Publication">
            {(Object.keys(STATUS) as Status[]).map((s) => (
              <label key={s} className={`flex cursor-pointer gap-3 border p-3 text-sm ${form.status === s ? "border-ink bg-paper" : "border-line"}`}>
                <input type="radio" name={radioName} checked={form.status === s} onChange={() => set({ status: s })} className="mt-1" />
                {STATUS[s]}
              </label>
            ))}
            {form.status === "scheduled" && (
              <label className="flex flex-col gap-1 text-xs text-muted">
                Goes live at (your local time)
                <input type="datetime-local" value={form.publishAt} onChange={(e) => set({ publishAt: e.target.value })} className={inputClass} />
              </label>
            )}
          </Panel>
          <Panel title="Cover">
            <ImageSlot
              label="Cover photo"
              hint="Horizontal 2:1, 2400×1200"
              ratio="2/1"
              media={cover}
              onChange={(m) => {
                setCover(m);
                setDirty(true);
              }}
              onPickFromLibrary={() => setLibrary(true)}
              onUpdateMedia={async (p) => {
                const r = await actions.updateMedia(p);
                if (!r.ok) setNotice(r);
              }}
            />
          </Panel>
          <Panel title="Categories">
            {categories.map((c) => (
              <label key={c.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.categoryIds.includes(c.id)} onChange={(e) => set({ categoryIds: e.target.checked ? [...form.categoryIds, c.id] : form.categoryIds.filter((x) => x !== c.id) })} />
                {c.name}
              </label>
            ))}
            <div className="flex gap-2">
              <input value={newCat} onChange={(e) => setNewCat(e.target.value)} maxLength={60} placeholder="New category" aria-label="New story category" className={inputClass} />
              <button
                type="button"
                className={smallButton}
                disabled={!newCat.trim() || pending}
                onClick={() =>
                  start(async () => {
                    const r = await actions.createCategory({ name: newCat, slug: slugify(newCat) });
                    if (r.ok && r.data) {
                      setCategories([...categories, r.data]);
                      set({ categoryIds: [...form.categoryIds, r.data.id] });
                      setNewCat("");
                    } else setNotice(r);
                  })
                }
              >
                Add
              </button>
            </div>
          </Panel>
          <Panel title="Origin and search" note="Optional.">
            <TextInput label="Imported from" value={form.importedFrom} max={200} onChange={(v) => set({ importedFrom: v })} placeholder="e.g. Old site (2021)" hint="For stories brought from the old site." />
            <TextInput label="Title in Google" value={form.seoTitle} max={70} onChange={(v) => set({ seoTitle: v })} placeholder={form.title} />
            <TextArea label="Description in Google" value={form.seoDescription} max={170} rows={2} onChange={(v) => set({ seoDescription: v })} placeholder={form.synopsis} />
          </Panel>
          {story && (
            <Panel title="History" note="Every save keeps the previous version.">
              {story.revisions.length === 0 && <p className="text-xs text-muted">No earlier versions yet.</p>}
              <ul className="flex flex-col divide-y divide-line text-xs">
                {story.revisions.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-2 py-2">
                    <span>
                      {dateTime.format(new Date(r.createdAt))}
                      {r.author && <span className="block text-muted">{r.author}</span>}
                    </span>
                    <button
                      type="button"
                      className={smallButton}
                      onClick={() =>
                        start(async () => {
                          const res = await actions.loadRevision(story.id, r.id);
                          setNotice(res);
                          if (res.ok && res.data) {
                            set(res.data);
                            setBodyKey(`rev-${r.id}`);
                          }
                        })
                      }
                    >
                      Load
                    </button>
                  </li>
                ))}
              </ul>
              {confirmDelete ? (
                <div className="flex flex-col gap-2 border border-alert p-3 text-xs">
                  <p>Delete this story permanently? Archive it to hide it instead.</p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="h-9 bg-alert px-3 font-mono text-[10px] uppercase tracking-[0.14em] text-paper"
                      onClick={() =>
                        start(async () => {
                          const r = await actions.remove(story.id);
                          setNotice(r);
                          if (r.ok) {
                            setDirty(false);
                            router.push("/admin/sci-fi");
                          }
                        })
                      }
                    >
                      Yes, delete
                    </button>
                    <button type="button" className={smallButton} onClick={() => setConfirmDelete(false)}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button type="button" className={dangerButton} onClick={() => setConfirmDelete(true)}>
                  Delete story
                </button>
              )}
            </Panel>
          )}
        </aside>
      </div>
      <MediaLibraryDialog
        open={library}
        onClose={() => setLibrary(false)}
        load={actions.listMedia}
        onPick={(m) => {
          setCover(m);
          setDirty(true);
        }}
      />
    </div>
  );
}
