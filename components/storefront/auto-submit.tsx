"use client";

import { useRef } from "react";

/**
 * Wraps a GET filter form: any change re-submits it, so filters apply as you click.
 * Without JavaScript the visible "Apply" button still works.
 */
export function AutoSubmitForm({ children, className, action }: { children: React.ReactNode; className?: string; action: string }) {
  const ref = useRef<HTMLFormElement>(null);
  return (
    <form
      ref={ref}
      action={action}
      method="get"
      className={className}
      onChange={(e) => {
        const t = e.target as unknown as HTMLInputElement;
        if (t.type === "number" || t.type === "search" || t.type === "text") return; // typed fields submit on Enter/Apply
        ref.current?.requestSubmit();
      }}
    >
      {children}
    </form>
  );
}
