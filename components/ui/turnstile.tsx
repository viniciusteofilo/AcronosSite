"use client";

import { useEffect, useRef } from "react";

type TurnstileApi = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  remove: (id: string) => void;
  reset: (id: string) => void;
};
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";
const SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let loading: Promise<TurnstileApi> | null = null;

function load(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  loading ??= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SCRIPT;
    s.async = true;
    s.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error("turnstile")));
    s.onerror = () => {
      loading = null;
      reject(new Error("turnstile"));
    };
    document.head.appendChild(s);
  });
  return loading;
}

export const humanCheckEnabled = !!SITE_KEY;

/**
 * Cloudflare Turnstile check (usually invisible, sometimes one click). Inside a <form> it adds the
 * hidden field "cf-turnstile-response"; onToken gives the token to forms that post with fetch.
 * Renders nothing when no site key is configured.
 */
export function HumanCheck({ action, onToken, resetKey }: { action: string; onToken?: (token: string | null) => void; resetKey?: unknown }) {
  const box = useRef<HTMLDivElement>(null);
  const tokenCb = useRef(onToken);
  useEffect(() => {
    tokenCb.current = onToken;
  });
  useEffect(() => {
    if (!SITE_KEY || !box.current) return;
    let id: string | null = null;
    let cancelled = false;
    load()
      .then((t) => {
        if (cancelled || !box.current) return;
        id = t.render(box.current, {
          sitekey: SITE_KEY,
          action,
          theme: "light",
          size: "flexible",
          callback: (token: string) => tokenCb.current?.(token),
          "expired-callback": () => tokenCb.current?.(null),
          "error-callback": () => tokenCb.current?.(null),
        });
      })
      .catch(() => tokenCb.current?.(null));
    return () => {
      cancelled = true;
      if (id && window.turnstile) window.turnstile.remove(id);
    };
  }, [action, resetKey]);
  if (!SITE_KEY) return null;
  return <div ref={box} className="min-h-[65px]" />;
}
