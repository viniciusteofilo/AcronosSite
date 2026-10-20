"use client";

import { useEffect, useRef, useState } from "react";
import type { MediaView } from "@/server/media/library";

type LibraryItem = MediaView & { originalName: string | null };

/** Grid of every uploaded image, to reuse a photo without uploading it again. */
export function MediaLibraryDialog({
  open,
  onClose,
  onPick,
  load,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (media: MediaView) => void;
  load: () => Promise<LibraryItem[]>;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [items, setItems] = useState<LibraryItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      load()
        .then(setItems)
        .catch(() => setError("Could not load the library. Your session may have expired."));
    }
    if (!open && d.open) d.close();
  }, [open, load]);

  return (
    <dialog
      ref={ref}
      aria-label="Image library"
      onClose={onClose}
      className="m-auto max-h-[85dvh] w-[min(960px,94vw)] bg-paper p-0 text-ink shadow-2xl backdrop:bg-ink/40"
    >
      <div className="flex items-center justify-between border-b border-line px-5 py-4">
        <h2 className="font-display text-sm uppercase tracking-[0.1em]">Image library</h2>
        <button type="button" onClick={onClose} className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted hover:text-ink">
          Close
        </button>
      </div>
      <div className="max-h-[70dvh] overflow-y-auto p-5">
        {error && <p role="alert" className="text-sm text-alert">{error}</p>}
        {!items && !error && <p className="text-sm text-muted">Loading…</p>}
        {items && items.length === 0 && <p className="text-sm text-muted">No images yet. Upload one from a photo slot.</p>}
        {items && items.length > 0 && (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {items.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => {
                    onPick(m);
                    onClose();
                  }}
                  className="group flex w-full flex-col gap-1 text-left"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- library thumbnail */}
                  <img src={m.src} srcSet={m.srcSet} sizes="220px" alt={m.alt} className="aspect-square w-full border border-line object-cover group-hover:border-ink" />
                  <span className="truncate text-[11px] text-muted">{m.originalName ?? m.alt ?? "Image"}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </dialog>
  );
}
