"use client";

import { useRef, useState, type DragEvent } from "react";
import type { MediaView } from "@/server/media/library";
import { uploadImage } from "./image-slot";
import { smallButton } from "./ui";

/**
 * Product photos. Drop several files at once, drag thumbnails to reorder (the first is the
 * cover in the shop), click one to set its focal point and description.
 */
export function ProductGallery({
  images,
  onChange,
  onPickFromLibrary,
  onUpdateMedia,
}: {
  images: MediaView[];
  /** Accepts a list or an updater, like a React state setter (uploads finish one after another). */
  onChange: (next: MediaView[] | ((prev: MediaView[]) => MediaView[])) => void;
  onPickFromLibrary: () => void;
  onUpdateMedia: (patch: { id: string; alt?: string; focalX?: number; focalY?: number }) => Promise<void>;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropActive, setDropActive] = useState(false);

  async function uploadFiles(files: File[]) {
    const list = files.filter((f) => f.type.startsWith("image/"));
    if (!list.length) return;
    setErrors([]);
    const failed: string[] = [];
    for (let i = 0; i < list.length; i++) {
      setProgress(`Optimizing and uploading ${i + 1} of ${list.length}…`);
      try {
        const media = await uploadImage(list[i]);
        onChange((prev) => [...prev, media]);
      } catch (e) {
        failed.push(`${list[i].name}: ${e instanceof Error ? e.message : "upload failed"}`);
      }
    }
    setProgress(null);
    setErrors(failed);
  }

  const move = (from: number, to: number) => {
    if (to < 0 || to >= images.length || from === to) return;
    const next = [...images];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
  };

  const current = images.find((m) => m.id === selected) ?? null;

  return (
    <div className="flex flex-col gap-4">
      <div
        onDragOver={(e) => {
          if (dragIndex !== null) return;
          e.preventDefault();
          setDropActive(true);
        }}
        onDragLeave={() => setDropActive(false)}
        onDrop={(e: DragEvent) => {
          if (dragIndex !== null) return;
          e.preventDefault();
          setDropActive(false);
          void uploadFiles([...e.dataTransfer.files]);
        }}
        className={`flex flex-col gap-4 border border-dashed p-4 ${dropActive ? "border-signal bg-signal/5" : "border-field"}`}
      >
        {images.length > 0 ? (
          <ol className="grid grid-cols-3 gap-3 sm:grid-cols-4 xl:grid-cols-6" aria-label="Product photos, in display order">
            {images.map((m, i) => (
              <li
                key={m.id}
                draggable
                onDragStart={() => setDragIndex(i)}
                onDragEnd={() => setDragIndex(null)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragIndex !== null) move(dragIndex, i);
                  setDragIndex(null);
                }}
                className={`group relative flex flex-col gap-1 ${dragIndex === i ? "opacity-40" : ""}`}
              >
                <button
                  type="button"
                  onClick={() => setSelected(selected === m.id ? null : m.id)}
                  aria-pressed={selected === m.id}
                  aria-label={`Photo ${i + 1}${i === 0 ? " (cover)" : ""}: edit focal point and description`}
                  className={`relative aspect-[4/5] w-full cursor-grab overflow-hidden border bg-canvas ${selected === m.id ? "border-ink ring-2 ring-ink" : "border-line hover:border-ink"}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- admin thumbnail */}
                  <img
                    src={m.src}
                    srcSet={m.srcSet}
                    sizes="160px"
                    alt=""
                    className="h-full w-full object-cover"
                    style={{ objectPosition: `${m.focalX * 100}% ${m.focalY * 100}%` }}
                  />
                  {i === 0 && (
                    <span className="absolute left-1 top-1 bg-ink px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-canvas">Cover</span>
                  )}
                  {!m.alt && (
                    <span className="absolute bottom-1 left-1 bg-paper/90 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-alert">No description</span>
                  )}
                </button>
                <div className="flex justify-between">
                  <button type="button" onClick={() => move(i, i - 1)} disabled={i === 0} aria-label={`Move photo ${i + 1} earlier`} className="px-1 font-mono text-xs text-muted hover:text-ink disabled:opacity-30">
                    ←
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(images.filter((x) => x.id !== m.id));
                      if (selected === m.id) setSelected(null);
                    }}
                    aria-label={`Remove photo ${i + 1} from this product`}
                    className="px-1 font-mono text-[10px] uppercase tracking-[0.1em] text-alert hover:underline"
                  >
                    Remove
                  </button>
                  <button type="button" onClick={() => move(i, i + 1)} disabled={i === images.length - 1} aria-label={`Move photo ${i + 1} later`} className="px-1 font-mono text-xs text-muted hover:text-ink disabled:opacity-30">
                    →
                  </button>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <div className="flex flex-col items-center gap-1 py-8 text-center text-muted">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em]">Drop photos here</p>
            <p className="text-xs">Several at once is fine. Vertical 4:5, at least 1600 px tall works best.</p>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={input}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            aria-label="Upload product photos"
            onChange={(e) => {
              void uploadFiles([...(e.target.files ?? [])]);
              e.target.value = "";
            }}
          />
          <button type="button" disabled={!!progress} onClick={() => input.current?.click()} className={`${smallButton} border-ink bg-ink text-canvas hover:bg-muted`}>
            Upload photos
          </button>
          <button type="button" disabled={!!progress} onClick={onPickFromLibrary} className={smallButton}>
            From library
          </button>
          {images.length > 1 && <span className="text-[11px] text-muted">Drag to reorder. The first photo is the cover.</span>}
        </div>
        {progress && (
          <p role="status" className="font-mono text-[10px] uppercase tracking-[0.16em] text-signal">
            {progress}
          </p>
        )}
        {errors.length > 0 && (
          <ul role="alert" className="text-xs text-alert">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}
      </div>

      {current && (
        <div className="grid gap-4 border border-line bg-paper p-4 sm:grid-cols-[200px_minmax(0,1fr)]">
          <button
            type="button"
            title="Click the part that must always stay visible"
            aria-label="Set focal point: click the part of the photo that must always stay visible"
            className="relative aspect-[4/5] w-full cursor-crosshair overflow-hidden border border-line"
            onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              const focalX = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
              const focalY = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
              onChange(images.map((x) => (x.id === current.id ? { ...x, focalX, focalY } : x)));
              void onUpdateMedia({ id: current.id, focalX, focalY });
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- admin preview */}
            <img src={current.src} srcSet={current.srcSet} sizes="200px" alt="" className="h-full w-full object-contain" />
            <span
              aria-hidden
              className="absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-paper bg-signal/70 shadow"
              style={{ left: `${current.focalX * 100}%`, top: `${current.focalY * 100}%` }}
            />
          </button>
          <div className="flex flex-col gap-3 text-xs text-muted">
            <p>Click the photo on the part that must never be cropped (face, logo, detail). Shop cards and phones keep it in view.</p>
            <label className="flex flex-col gap-1">
              Description for screen readers and Google (alt text)
              <input
                key={current.id}
                defaultValue={current.alt}
                maxLength={300}
                placeholder="e.g. Front view of the black shell jacket, hood up"
                onBlur={(e) => {
                  const alt = e.target.value;
                  if (alt !== current.alt) {
                    onChange(images.map((x) => (x.id === current.id ? { ...x, alt } : x)));
                    void onUpdateMedia({ id: current.id, alt });
                  }
                }}
                className="h-10 border border-field bg-surface px-3 text-sm text-ink"
              />
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
