"use client";

import { useRef } from "react";

/** Changing the number updates the cart right away (works without JavaScript via the button). */
export function QuantitySelect({ variantId, quantity, max, action }: { variantId: string; quantity: number; max: number; action: (form: FormData) => Promise<void> }) {
  const form = useRef<HTMLFormElement>(null);
  return (
    <form ref={form} action={action} className="flex items-center gap-2">
      <input type="hidden" name="variantId" value={variantId} />
      <label className="sr-only" htmlFor={`qty-${variantId}`}>
        Quantity
      </label>
      <select id={`qty-${variantId}`} name="quantity" defaultValue={quantity} onChange={() => form.current?.requestSubmit()} className="h-9 border border-field bg-surface px-2 text-sm">
        {Array.from({ length: Math.max(1, max) }, (_, i) => i + 1).map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
      <noscript>
        <button type="submit">Update</button>
      </noscript>
    </form>
  );
}
