import type { InputHTMLAttributes } from "react";

export function Field({
  label,
  id,
  hint,
  error,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; id: string; hint?: string; error?: string }) {
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="font-mono text-[10px] uppercase tracking-[0.18em] text-steel">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`h-12 rounded-sm border bg-carbon px-4 text-snow placeholder:text-steel/50 ${
          error ? "border-alert" : "border-concrete hover:border-steel/60"
        }`}
        {...props}
      />
      {hint && !error && (
        <p id={`${id}-hint`} className="text-xs text-steel">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-xs text-alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function Checkbox({ label, id, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; id: string }) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-center gap-3 text-sm text-snow/90">
      <input id={id} type="checkbox" className="h-4 w-4 appearance-none border border-steel/70 bg-transparent checked:border-snow checked:bg-snow" {...props} />
      {label}
    </label>
  );
}
