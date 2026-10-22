"use client";

import { useRef, useState } from "react";
import {
  extractFrames,
  FILM_MAX_SECONDS,
  uploadFilm,
  type UploadedFilm,
} from "@/lib/video-frames";

/**
 * Campaign film for the top of the homepage. Pick a short MP4 (up to 12 seconds); the browser
 * cuts it into frames, uploads them, and the film plays as visitors scroll.
 */
export function FilmSlot({
  film,
  onChange,
}: {
  film: UploadedFilm | null;
  onChange: (film: UploadedFilm | null) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<{
    stage: string;
    done: number;
    total: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handle(file: File | undefined) {
    if (!file) return;
    setError(null);
    try {
      const frames = await extractFrames(file, (stage, done, total) =>
        setProgress({ stage, done, total }),
      );
      const uploaded = await uploadFilm(file, frames, (stage, done, total) =>
        setProgress({ stage, done, total }),
      );
      onChange(uploaded);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "The film could not be prepared.",
      );
    } finally {
      setProgress(null);
    }
  }

  const first = film
    ? film.pattern.replace("{size}", "d").replace("{n}", "0000")
    : null;
  const last = film
    ? film.pattern
        .replace("{size}", "d")
        .replace("{n}", String(film.frameCount - 1).padStart(4, "0"))
    : null;

  return (
    <div className="flex flex-col gap-4">
      {film ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {[first, last].map((src, i) => (
            <figure key={i} className="flex flex-col gap-1">
              {/* eslint-disable-next-line @next/next/no-img-element -- admin preview of a frame */}
              <img
                src={src!}
                alt=""
                className="aspect-video w-full border border-line object-cover"
              />
              <figcaption className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
                {i === 0 ? "First frame (shown while loading)" : "Last frame"}
              </figcaption>
            </figure>
          ))}
          <p className="text-xs text-muted sm:col-span-2">
            {film.frameCount} frames · {film.width}×{film.height} on computers,{" "}
            {film.mobileWidth}×{film.mobileHeight} on phones
          </p>
        </div>
      ) : (
        <p className="border border-dashed border-field p-6 text-center text-sm text-muted">
          No film. The homepage starts with the main photo. Add a short video
          (MP4, up to {FILM_MAX_SECONDS} seconds, horizontal, subject in the
          center) to open the page with a film that plays as visitors scroll.
        </p>
      )}
      {progress && (
        <div role="status" className="flex flex-col gap-1">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-signal-ink">
            {progress.stage} {progress.done}/{progress.total}… keep this page
            open
          </p>
          <div className="h-1 w-full bg-line">
            <div
              className="h-1 bg-ink transition-[width]"
              style={{ width: `${(progress.done / progress.total) * 100}%` }}
            />
          </div>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <input
          ref={input}
          type="file"
          accept="video/mp4,video/quicktime,video/webm"
          className="hidden"
          aria-label="Choose campaign video"
          onChange={(e) => {
            void handle(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          disabled={!!progress}
          onClick={() => input.current?.click()}
          className="h-9 border border-ink bg-ink px-3 font-mono text-[10px] uppercase tracking-[0.14em] text-canvas hover:bg-muted disabled:opacity-50"
        >
          {film ? "Replace video" : "Upload video"}
        </button>
        {film && (
          <button
            type="button"
            disabled={!!progress}
            onClick={() => onChange(null)}
            className="h-9 px-3 font-mono text-[10px] uppercase tracking-[0.14em] text-alert hover:underline"
          >
            Remove film
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="text-xs text-alert">
          {error}
        </p>
      )}
    </div>
  );
}
