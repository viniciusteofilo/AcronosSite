"use client";

import { useRef, useState, type DragEvent } from "react";
import { resizeForWeb } from "@/lib/image-resize";
import type { MediaView } from "@/server/media/library";

export async function uploadImage(file: File, alt = ""): Promise<MediaView> {
  const { blobs } = await resizeForWeb(file);
  const form = new FormData();
  blobs.forEach((b, i) => form.append("file", new File([b], `r${i}.webp`, { type: "image/webp" })));
  form.append("alt", alt);
  form.append("originalName", file.name);
  const res = await fetch("/api/admin/media", { method: "POST", body: form });
  const body = (await res.json().catch(() => ({}))) as { media?: MediaView; error?: string };
  if (!res.ok || !body.media) {
    throw new Error(
      res.status === 401 ? "Your session expired. Sign in again." : body.error ?? "The upload failed. Try again.",
    );
  }
  return body.media;
}

/**
 * One photo on the site. Drop a file on it, click "Replace photo", or pick one from the
 * library. Clicking the photo sets the focal point that stays visible on phones.
 */
export function ImageSlot({
  label,
  hint,
  media,
  ratio,
  onChange,
  onPickFromLibrary,
  onUpdateMedia,
}: {
  label: string;
  hint: string;
  media: MediaView | null;
  ratio: string;
  onChange: (media: MediaView | null) => void;
  onPickFromLibrary: () => void;
  onUpdateMedia: (patch: { id: string; alt?: string; focalX?: number; focalY?: number }) => Promise<void>;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      onChange(await uploadImage(file, media?.alt ?? ""));
    } catch (e) {
      setError(e instanceof Error ? e.message : "The upload failed.");
    } finally {
      setBusy(false);
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    void handleFile(e.dataTransfer.files[0]);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em]">{label}</p>
        <p className="text-[11px] text-muted">{hint}</p>
      </div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        style={{ aspectRatio: ratio }}
        className={`relative overflow-hidden border ${dragging ? "border-signal bg-signal/5" : "border-line bg-canvas"}`}
      >
        {media ? (
          <button
            type="button"
            title="Click to set the focal point"
            aria-label="Set focal point: click the part of the photo that must always stay visible"
            className="absolute inset-0 cursor-crosshair"
            onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              const focalX = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
              const focalY = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
              onChange({ ...media, focalX, focalY });
              void onUpdateMedia({ id: media.id, focalX, focalY });
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- admin preview of an uploaded image */}
            <img
              src={media.src}
              srcSet={media.srcSet}
              sizes="480px"
              alt=""
              className="h-full w-full object-cover"
              style={{ objectPosition: `${media.focalX * 100}% ${media.focalY * 100}%` }}
            />
            <span
              aria-hidden
              className="absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-paper bg-signal/70 shadow"
              style={{ left: `${media.focalX * 100}%`, top: `${media.focalY * 100}%` }}
            />
          </button>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center text-muted">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em]">Drop a photo here</p>
            <p className="text-xs">or use the buttons below</p>
          </div>
        )}
        {busy && (
          <div role="status" className="absolute inset-0 flex items-center justify-center bg-paper/80 font-mono text-[10px] uppercase tracking-[0.18em]">
            Optimizing and uploading…
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => void handleFile(e.target.files?.[0])} />
        <button type="button" disabled={busy} onClick={() => input.current?.click()} className="h-9 border border-ink bg-ink px-3 font-mono text-[10px] uppercase tracking-[0.14em] text-canvas hover:bg-muted disabled:opacity-50">
          {media ? "Replace photo" : "Upload photo"}
        </button>
        <button type="button" disabled={busy} onClick={onPickFromLibrary} className="h-9 border border-field px-3 font-mono text-[10px] uppercase tracking-[0.14em] hover:border-ink">
          From library
        </button>
        {media && (
          <button type="button" disabled={busy} onClick={() => onChange(null)} className="h-9 px-3 font-mono text-[10px] uppercase tracking-[0.14em] text-alert hover:underline">
            Remove
          </button>
        )}
      </div>
      {media && (
        <label className="flex flex-col gap-1 text-xs text-muted">
          Description for screen readers and Google (alt text)
          <input
            key={media.id}
            defaultValue={media.alt}
            maxLength={300}
            placeholder="e.g. Model in black shell jacket on a concrete stairway"
            onBlur={(e) => {
              if (e.target.value !== media.alt) {
                onChange({ ...media, alt: e.target.value });
                void onUpdateMedia({ id: media.id, alt: e.target.value });
              }
            }}
            className="h-9 border border-field bg-surface px-3 text-sm text-ink"
          />
        </label>
      )}
      {error && (
        <p role="alert" className="text-xs text-alert">
          {error}
        </p>
      )}
    </div>
  );
}
