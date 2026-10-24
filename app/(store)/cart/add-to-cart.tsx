"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { addToCartAction, type CartResult } from "./actions";

/** Submit button for the product page; the server checks stock and price again. */
export function AddToCartForm({ variantId, disabled, label }: { variantId: string | null; disabled: boolean; label: string }) {
  const [state, action, pending] = useActionState<CartResult, FormData>(addToCartAction, null);
  return (
    <form action={action} className="flex flex-col gap-3">
      {variantId && <input type="hidden" name="variantId" value={variantId} />}
      <Button type="submit" className="w-full" disabled={disabled || pending}>
        {pending ? "Adding…" : label}
      </Button>
      {state && (
        <p role={state.ok ? "status" : "alert"} className={`text-center text-sm ${state.ok ? "" : "text-alert"}`}>
          {state.message}{" "}
          {state.ok && (
            <Link href="/cart" className="underline">
              View cart
            </Link>
          )}
        </p>
      )}
    </form>
  );
}
