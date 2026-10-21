"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Re-reads the order every few seconds for up to two minutes while the payment is confirmed. */
export function AutoRefresh() {
  const router = useRouter();
  useEffect(() => {
    let n = 0;
    const id = setInterval(() => {
      if (++n > 40) clearInterval(id);
      else router.refresh();
    }, 3000);
    return () => clearInterval(id);
  }, [router]);
  return null;
}
