import type { InputHTMLAttributes } from "react";

export function Field({
  label,
  id,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; id: string }) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="font-mono text-xs uppercase tracking-[0.12em] text-steel">
        {label}
      </label>
      <input
        id={id}
        className="h-11 rounded-sm border border-concrete bg-carbon px-3 text-snow placeholder:text-steel/60"
        {...props}
      />
    </div>
  );
}
