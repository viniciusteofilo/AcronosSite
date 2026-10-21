"use client";

import { useEffect, useId, type ReactNode } from "react";

/** Shared building blocks for admin editors, so every screen looks and behaves the same. */

export const inputClass = "h-10 w-full border border-field bg-paper px-3 text-sm text-ink focus:border-ink";
export const smallButton =
  "inline-flex h-9 items-center justify-center border border-field px-3 font-mono text-[10px] uppercase tracking-[0.14em] hover:border-ink disabled:opacity-50";
export const primaryButton =
  "inline-flex h-10 items-center justify-center bg-ink px-5 font-mono text-[10px] uppercase tracking-[0.14em] text-canvas hover:bg-muted disabled:opacity-50";
export const secondaryButton =
  "inline-flex h-10 items-center justify-center border border-field px-4 font-mono text-[10px] uppercase tracking-[0.14em] hover:border-ink disabled:opacity-50";
export const dangerButton =
  "inline-flex h-10 items-center justify-center px-3 font-mono text-[10px] uppercase tracking-[0.14em] text-alert hover:underline disabled:opacity-50";

export function Panel({ title, note, children, id }: { title: string; note?: string; children: ReactNode; id?: string }) {
  return (
    <section id={id} aria-labelledby={id ? `${id}-title` : undefined} className="flex min-w-0 flex-col gap-5 border border-line bg-surface p-5 sm:p-6">
      <div className="flex flex-col gap-1">
        <h2 id={id ? `${id}-title` : undefined} className="font-display text-sm uppercase tracking-[0.1em]">
          {title}
        </h2>
        {note && <p className="text-xs text-muted">{note}</p>}
      </div>
      {children}
    </section>
  );
}

export function TextInput({
  label,
  value,
  onChange,
  max,
  hint,
  placeholder,
  mono,
  required,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  max?: number;
  hint?: string;
  placeholder?: string;
  mono?: boolean;
  required?: boolean;
  type?: string;
}) {
  const id = useId();
  return (
    <div className="flex min-w-0 flex-col gap-1 text-xs text-muted">
      <span className="flex justify-between gap-2">
        <label htmlFor={id}>
          {label}
          {required && <span aria-hidden> *</span>}
        </label>
        {max && <Counter length={value.length} max={max} />}
      </span>
      <input
        id={id}
        type={type}
        value={value}
        maxLength={max}
        placeholder={placeholder}
        required={required}
        aria-describedby={hint ? `${id}-hint` : undefined}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputClass} ${mono ? "font-mono text-xs" : ""}`}
      />
      {hint && (
        <span id={`${id}-hint`} className="text-[11px]">
          {hint}
        </span>
      )}
    </div>
  );
}

function Counter({ length, max }: { length: number; max: number }) {
  return (
    <span aria-hidden className={`font-mono text-[10px] ${length > max * 0.9 ? "text-alert" : ""}`}>
      {length}/{max}
    </span>
  );
}

export function TextArea({
  label,
  value,
  onChange,
  max,
  rows = 4,
  hint,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  max: number;
  rows?: number;
  hint?: string;
  placeholder?: string;
}) {
  const id = useId();
  return (
    <div className="flex min-w-0 flex-col gap-1 text-xs text-muted">
      <span className="flex justify-between gap-2">
        <label htmlFor={id}>{label}</label>
        <Counter length={value.length} max={max} />
      </span>
      <textarea
        id={id}
        value={value}
        maxLength={max}
        rows={rows}
        placeholder={placeholder}
        aria-describedby={hint ? `${id}-hint` : undefined}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-field bg-paper p-3 text-sm leading-relaxed text-ink focus:border-ink"
      />
      {hint && (
        <span id={`${id}-hint`} className="text-[11px]">
          {hint}
        </span>
      )}
    </div>
  );
}

export function Notice({ result }: { result: { ok: boolean; message: string } | null }) {
  if (!result || !result.message) return null;
  return (
    <p
      role={result.ok ? "status" : "alert"}
      className={`border px-4 py-3 text-sm ${result.ok ? "border-line bg-paper" : "border-alert bg-paper text-alert"}`}
    >
      {result.message}
    </p>
  );
}

const STATUS_STYLE: Record<string, string> = {
  published: "border-signal/60 text-signal-ink",
  scheduled: "border-signal/60 text-signal-ink",
  draft: "border-line text-muted",
  archived: "border-line text-muted line-through",
};

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  return (
    <span className={`inline-flex h-6 items-center border px-2 font-mono text-[10px] uppercase tracking-[0.14em] ${STATUS_STYLE[status] ?? STATUS_STYLE.draft}`}>
      {label ?? status}
    </span>
  );
}

/** Sticky bar at the top of an editor with the save state and main buttons. */
export function SaveBar({ status, tone, children }: { status: string; tone?: "alert" | "signal" | "muted"; children: ReactNode }) {
  const color = tone === "alert" ? "text-alert" : tone === "signal" ? "text-signal-ink" : "text-muted";
  return (
    <div className="sticky top-0 z-20 -mx-4 flex flex-wrap items-center justify-between gap-3 border-b border-line bg-surface/95 px-4 py-3 backdrop-blur md:-mx-8 md:px-8">
      <p className={`font-mono text-[10px] uppercase tracking-[0.16em] ${color}`} role="status">
        {status}
      </p>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

/** Warns before leaving the page with unsaved changes. */
export function useUnsavedWarning(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);
}

/** Converts between an ISO timestamp and the value of an <input type="datetime-local">. */
export function isoToLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function localInputToIso(v: string): string | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export const dateTime = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" });
