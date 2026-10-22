"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { SequenceView } from "@/server/media/sequences";

const REDUCE = "(prefers-reduced-motion: reduce)";
const saveData = () => (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true;
const subscribeStill = (cb: () => void) => {
  const mq = window.matchMedia(REDUCE);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};
const stillSnapshot = () => window.matchMedia(REDUCE).matches || saveData();

const frameUrl = (pattern: string, size: "d" | "m", i: number) => pattern.replace("{size}", size).replace("{n}", String(i).padStart(4, "0"));

/**
 * Campaign film that plays as the visitor scrolls (frames drawn on a canvas, like Apple product
 * pages). Light on purpose: only the first frame loads with the page, the rest load in the
 * background; phones get smaller frames; with reduced motion or data saver only the first frame shows.
 * Text never sits on the film: the caption has its own band.
 */
export function ScrollFilm({ film, caption, label }: { film: SequenceView; caption: string; label: string }) {
  const section = useRef<HTMLElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  // reduced motion or data saver: only the first frame, no scroll animation
  const still = useSyncExternalStore(subscribeStill, stillSnapshot, () => false);
  const [loaded, setLoaded] = useState(0);

  useEffect(() => {
    if (still) return;
    const size: "d" | "m" = window.innerWidth < 768 ? "m" : "d";
    const w = size === "d" ? film.width : film.mobileWidth;
    const h = size === "d" ? film.height : film.mobileHeight;
    const c = canvas.current!;
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d")!;
    const frames: (HTMLImageElement | null)[] = Array(film.frameCount).fill(null);
    let current = -1;
    let raf = 0;
    let cancelled = false;

    const nearestLoaded = (i: number) => {
      for (let d = 0; d < film.frameCount; d++) {
        if (frames[i - d]) return frames[i - d];
        if (frames[i + d]) return frames[i + d];
      }
      return null;
    };
    const draw = () => {
      raf = 0;
      const el = section.current;
      if (!el) return;
      // the stage sticks just under the header; progress runs while it is pinned
      const stage = el.firstElementChild as HTMLElement;
      const top = parseFloat(getComputedStyle(stage).top) || 0;
      const distance = el.offsetHeight - stage.offsetHeight;
      const progress = distance > 0 ? Math.min(1, Math.max(0, (top - el.getBoundingClientRect().top) / distance)) : 0;
      const i = Math.round(progress * (film.frameCount - 1));
      const img = nearestLoaded(i);
      if (img && (i !== current || !frames[current])) {
        ctx.drawImage(img, 0, 0, w, h);
        current = i;
      }
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(draw);
    };

    // load order: first frame, then every 8th, then every 4th, 2nd, rest — playable early, sharper over time
    const order: number[] = [];
    for (const step of [8, 4, 2, 1]) for (let i = 0; i < film.frameCount; i += step) if (!order.includes(i)) order.push(i);
    let next = 0;
    let count = 0;
    const loadNext = () => {
      if (cancelled || next >= order.length) return;
      const i = order[next++];
      const img = new Image();
      img.decoding = "async";
      img.onload = () => {
        frames[i] = img;
        count++;
        if (count % 10 === 0 || count === film.frameCount) setLoaded(count);
        schedule();
        loadNext();
      };
      img.onerror = loadNext;
      img.src = frameUrl(film.pattern, size, i);
    };
    // a few parallel lanes after the page has settled
    const start = () => {
      for (let lane = 0; lane < 4; lane++) loadNext();
    };
    if (document.readyState === "complete") start();
    else window.addEventListener("load", start, { once: true });

    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelled = true;
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("load", start);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [film, still]);

  const poster = frameUrl(film.pattern, "d", 0);
  const posterMobile = frameUrl(film.pattern, "m", 0);

  return (
    <section ref={section} aria-label={label} className={`relative bg-ink ${still ? "h-[calc(100svh-4rem-1px)]" : "h-[260svh]"}`}>
      <div className="sticky top-[calc(4rem+1px)] flex h-[calc(100svh-4rem-1px)] flex-col">
        <div className="relative min-h-0 flex-1 overflow-hidden">
          {/* first frame as a real image: shows instantly, works without JavaScript */}
          <picture>
            <source media="(max-width: 767px)" srcSet={posterMobile} />
            <img src={poster} alt="" fetchPriority="high" className="absolute inset-0 h-full w-full object-cover" />
          </picture>
          {!still && <canvas ref={canvas} aria-hidden className="absolute inset-0 h-full w-full object-cover" />}
        </div>
        <div className="flex items-center justify-between gap-4 bg-ink px-4 py-3 font-mono text-[10px] uppercase tracking-[0.2em] text-canvas sm:px-8">
          <p>{caption}</p>
          <a href="#hero-title" className="shrink-0 underline-offset-4 hover:underline">
            Skip ↓
          </a>
          <span className="sr-only" aria-live="polite">
            {loaded === film.frameCount ? "Film loaded" : ""}
          </span>
        </div>
      </div>
    </section>
  );
}
