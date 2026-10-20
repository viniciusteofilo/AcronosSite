"use client";

import { useRef, useState } from "react";
import type { ActionResult } from "@/app/admin/site/actions";
import type { MediaView } from "@/server/media/library";
import { uploadImage } from "./image-slot";

type Item = MediaView & { originalName: string | null; createdAt: string };

/** Bulk upload (drop many photos at once) and alt-text editing for the image library. */
export function MediaManager({
  initial,
  updateMedia,
}: {
  initial: Item[];
  updateMedia: (p: { id: string; alt?: string }) => Promise<ActionResult>;
}) {
  const [items, setItems] = useState(initial);
  const [queue, setQueue] = useState<{ name: string; state: "waiting" | "uploading" | "done" | string }[]>([]);
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  async function uploadAll(files: File[]) {
    setQueue(files.map((f) => ({ name: f.name, state: "waiting" })));
    for (let i = 0; i < files.length; i++) {
      setQueue((q) => q.map((e, j) => (j === i ? { ...e, state: "uploading" } : e)));
      try {
        const m = await uploadImage(files[i]);
        setItems((all) => [{ ...m, originalName: files[i].name, createdAt: new Date().toISOString() }, ...all]);
        setQueue((q) => q.map((e, j) => (j === i ? { ...e, state: "done" } : e)));
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed";
        setQueue((q) => q.map((e, j) => (j === i ? { ...e, state: message } : e)));
      }
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void uploadAll([...e.dataTransfer.files].filter((f) => f.type.startsWith("image/")));
        }}
        className={`flex flex-col items-center gap-3 border border-dashed px-6 py-10 text-center ${dragging ? "border-signal bg-signal/5" : "border-field bg-surface"}`}
      >
        <p className="font-mono text-[11px] uppercase tracking-[0.16em]">Drop photos here</p>
        <p className="text-xs text-muted">JPG, PNG or WebP. They are resized for phones and large screens automatically.</p>
        <input ref={input} type="file" accept="image/*" multiple className="hidden" onChange={(e) => void uploadAll([...(e.target.files ?? [])])} />
        <button type="button" onClick={() => input.current?.click()} className="h-10 bg-ink px-4 font-mono text-[10px] uppercase tracking-[0.14em] text-canvas">
          Choose photos
        </button>
      </div>
      {queue.length > 0 && (
        <ul className="flex flex-col gap-1 text-xs" aria-live="polite">
          {queue.map((q, i) => (
            <li key={i} className={q.state === "done" ? "text-muted" : q.state === "waiting" || q.state === "uploading" ? "" : "text-alert"}>
              {q.name}: {q.state === "done" ? "uploaded" : q.state === "uploading" ? "uploading…" : q.state === "waiting" ? "waiting" : q.state}
            </li>
          ))}
        </ul>
      )}
      {items.length === 0 ? (
        <p className="text-sm text-muted">No images yet.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
          {items.map((m) => (
            <li key={m.id} className="flex flex-col gap-2 border border-line bg-surface p-2">
              {/* eslint-disable-next-line @next/next/no-img-element -- library thumbnail */}
              <img src={m.src} srcSet={m.srcSet} sizes="240px" alt={m.alt} className="aspect-square w-full object-cover" />
              <p className="truncate text-[11px] text-muted" title={m.originalName ?? undefined}>
                {m.originalName ?? "Image"} · {m.width}×{m.height}
              </p>
              <label className="sr-only" htmlFor={`alt-${m.id}`}>
                Alt text
              </label>
              <input
                id={`alt-${m.id}`}
                defaultValue={m.alt}
                placeholder="Describe the photo (alt text)"
                maxLength={300}
                onBlur={(e) => {
                  if (e.target.value !== m.alt) void updateMedia({ id: m.id, alt: e.target.value });
                }}
                className="h-8 border border-field bg-paper px-2 text-xs"
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
