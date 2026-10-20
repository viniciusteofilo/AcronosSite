"use client";

import { useId, useState } from "react";

/**
 * Size and color pickers built on native radio inputs: keyboard (arrow keys),
 * screen readers and forms work without extra code. Out-of-stock options stay
 * visible but disabled and say so in their accessible name.
 */
export type Option = { value: string; label: string; available?: boolean; swatch?: string };

export function SizeSelector({
  name,
  options,
  defaultValue,
  legend = "Size",
}: {
  name: string;
  options: Option[];
  defaultValue?: string;
  legend?: string;
}) {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-3 font-mono text-[10px] uppercase tracking-[0.18em] text-muted">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const disabled = o.available === false;
          return (
            <label key={o.value} className="relative">
              <input
                type="radio"
                name={name}
                value={o.value}
                defaultChecked={o.value === defaultValue}
                disabled={disabled}
                aria-label={disabled ? `${o.label}, sold out` : o.label}
                className="peer sr-only"
              />
              <span
                className={`flex h-11 min-w-11 items-center justify-center border px-3 font-mono text-xs uppercase transition-colors peer-checked:border-ink peer-checked:bg-ink peer-checked:text-canvas peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-signal ${
                  disabled
                    ? "cursor-not-allowed border-line text-muted/40 line-through"
                    : "cursor-pointer border-line text-ink hover:border-muted"
                }`}
              >
                {o.label}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export function ColorSelector({
  name,
  options,
  defaultValue,
  legend = "Color",
}: {
  name: string;
  options: Option[];
  defaultValue?: string;
  legend?: string;
}) {
  const [selected, setSelected] = useState(defaultValue ?? options[0]?.value);
  const id = useId();
  const current = options.find((o) => o.value === selected);
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-3 font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
        {legend}
        {current && <span className="ml-2 text-ink" id={`${id}-current`}>{current.label}</span>}
      </legend>
      <div className="flex flex-wrap gap-3">
        {options.map((o) => (
          <label key={o.value} className="relative">
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={selected === o.value}
              onChange={() => setSelected(o.value)}
              disabled={o.available === false}
              aria-label={o.available === false ? `${o.label}, sold out` : o.label}
              className="peer sr-only"
            />
            <span
              className="block h-8 w-8 cursor-pointer rounded-full border border-line ring-offset-2 ring-offset-canvas peer-checked:ring-1 peer-checked:ring-ink peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-signal peer-disabled:cursor-not-allowed peer-disabled:opacity-30"
              style={{ background: o.swatch }}
            />
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function QuantityStepper({ max = 10, label = "Quantity" }: { max?: number; label?: string }) {
  const [qty, setQty] = useState(1);
  const id = useId();
  return (
    <div className="flex flex-col gap-3">
      <label htmlFor={id} className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
        {label}
      </label>
      <div className="flex h-11 w-32 items-stretch border border-line">
        <button type="button" aria-label="Decrease quantity" disabled={qty <= 1} onClick={() => setQty((q) => Math.max(1, q - 1))} className="w-10 text-lg disabled:opacity-30">
          −
        </button>
        <input
          id={id}
          inputMode="numeric"
          value={qty}
          onChange={(e) => {
            const n = Number(e.target.value.replace(/\D/g, ""));
            setQty(Math.min(max, Math.max(1, n || 1)));
          }}
          className="w-full bg-transparent text-center font-mono text-sm"
        />
        <button type="button" aria-label="Increase quantity" disabled={qty >= max} onClick={() => setQty((q) => Math.min(max, q + 1))} className="w-10 text-lg disabled:opacity-30">
          +
        </button>
      </div>
    </div>
  );
}
