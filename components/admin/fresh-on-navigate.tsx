"use client";

import { useRouter } from "next/navigation";
import { Fragment, type ReactNode } from "react";

/**
 * Next.js keeps visited pages alive (React Activity), which would show the last "New product"
 * form again with its old values. This resets the children on every fresh visit, while browser
 * back/forward still restores what was typed.
 */
export function FreshOnNavigate({ children }: { children: ReactNode }) {
  const { bfcacheId } = useRouter();
  return <Fragment key={bfcacheId}>{children}</Fragment>;
}
