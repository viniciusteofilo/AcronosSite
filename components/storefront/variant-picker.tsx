"use client";

import { useMemo, useState } from "react";
import { AddToCartForm } from "@/app/(store)/cart/add-to-cart";
import { Button } from "@/components/ui/button";

export type PickerVariant = {
  id: string;
  sku: string;
  size: string | null;
  color: string | null;
  colorHex: string | null;
  price: string;
  compareAt: string | null;
  available: number;
};

const SIZE_ORDER = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "XXXL"];

/**
 * Color and size selection for a product. Price, SKU and availability follow the chosen
 * variant. The button adds to the cart only while the store is open for orders.
 */
export function VariantPicker({ variants, checkoutOpen = false }: { variants: PickerVariant[]; checkoutOpen?: boolean }) {
  const colors = useMemo(() => {
    const seen = new Map<string, string | null>();
    for (const v of variants) if (v.color && !seen.has(v.color)) seen.set(v.color, v.colorHex);
    return [...seen].map(([name, hex]) => ({ name, hex }));
  }, [variants]);
  const [color, setColor] = useState<string | null>(colors[0]?.name ?? null);
  const forColor = variants.filter((v) => !color || v.color === color);
  const sizes = [...new Set(forColor.map((v) => v.size).filter((s): s is string => Boolean(s)))].sort(
    (a, b) => (SIZE_ORDER.indexOf(a) + 1 || 99) - (SIZE_ORDER.indexOf(b) + 1 || 99),
  );
  const [size, setSize] = useState<string | null>(null);
  const selected =
    forColor.find((v) => (sizes.length === 0 ? true : v.size === size)) ?? (sizes.length === 0 ? forColor[0] : undefined);
  const shown = selected ?? forColor[0] ?? variants[0];
  const soldOut = forColor.every((v) => v.available <= 0);

  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-col gap-1">
        <p className="font-mono text-lg tracking-[0.06em]" aria-live="polite">
          {shown.compareAt && (
            <>
              <span className="sr-only">Was </span>
              <s className="mr-3 text-muted">{shown.compareAt}</s>
              <span className="sr-only">now </span>
            </>
          )}
          {shown.price}
        </p>
        <p className="text-xs text-muted">Prices in USD. Duties and taxes are calculated at checkout.</p>
      </div>

      {colors.length > 0 && (
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-3 font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
            Color <span className="ml-2 text-ink">{color}</span>
          </legend>
          <div className="flex flex-wrap gap-3">
            {colors.map((c) => (
              <label key={c.name} className="relative">
                <input
                  type="radio"
                  name="color"
                  value={c.name}
                  checked={color === c.name}
                  onChange={() => {
                    setColor(c.name);
                    setSize(null);
                  }}
                  aria-label={c.name}
                  className="peer sr-only"
                />
                <span
                  className="flex h-9 min-w-9 cursor-pointer items-center justify-center rounded-full border border-field ring-offset-2 ring-offset-canvas peer-checked:ring-1 peer-checked:ring-ink peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-signal"
                  style={{ background: c.hex ?? undefined }}
                >
                  {!c.hex && <span className="px-3 font-mono text-[10px] uppercase">{c.name}</span>}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {sizes.length > 0 && (
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-3 font-mono text-[10px] uppercase tracking-[0.18em] text-muted">Size</legend>
          <div className="flex flex-wrap gap-2">
            {sizes.map((s) => {
              const v = forColor.find((x) => x.size === s);
              const out = !v || v.available <= 0;
              return (
                <label key={s} className="relative">
                  <input
                    type="radio"
                    name="size"
                    value={s}
                    checked={size === s}
                    disabled={out}
                    onChange={() => setSize(s)}
                    aria-label={out ? `${s}, sold out` : s}
                    className="peer sr-only"
                  />
                  <span
                    className={`flex h-11 min-w-11 items-center justify-center border px-3 font-mono text-xs uppercase transition-colors peer-checked:border-ink peer-checked:bg-ink peer-checked:text-canvas peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-signal ${
                      out ? "cursor-not-allowed border-line text-muted/60 line-through" : "cursor-pointer border-field hover:border-ink"
                    }`}
                  >
                    {s}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      )}

      <div className="flex flex-col gap-3">
        {checkoutOpen ? (
          <AddToCartForm
            variantId={selected && selected.available > 0 ? selected.id : null}
            disabled={soldOut || !selected || selected.available <= 0}
            label={soldOut ? "Sold out" : sizes.length > 0 && !size ? "Select a size" : selected && selected.available <= 0 ? "Sold out" : "Add to cart"}
          />
        ) : (
          <Button type="button" className="w-full" disabled>
            {soldOut ? "Sold out" : "Online store opening soon"}
          </Button>
        )}
        <p className="text-center font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
          {shown.sku}
          {selected && selected.available > 0 && selected.available <= 3 && <> · Only {selected.available} left</>}
        </p>
      </div>
    </div>
  );
}
