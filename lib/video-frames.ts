/**
 * Runs in the admin's browser: turns a short campaign video into still WebP frames (desktop and
 * phone sizes) and uploads them. Nothing is processed on the server except validation.
 */

export const FILM_FPS = 12;
export const FILM_MAX_SECONDS = 12;
const DESKTOP_WIDTH = 1600;
const MOBILE_WIDTH = 800;

type Progress = (stage: string, done: number, total: number) => void;

const even = (n: number) => Math.max(2, Math.round(n / 2) * 2);

function loadVideo(file: File): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const v = document.createElement("video");
    v.muted = true;
    v.playsInline = true;
    v.preload = "auto";
    v.src = URL.createObjectURL(file);
    v.onloadeddata = () => resolve(v);
    v.onerror = () => reject(new Error("This video format cannot be read by the browser. Export it as MP4 (H.264) and try again."));
  });
}

function seek(v: HTMLVideoElement, t: number): Promise<void> {
  return new Promise((resolve) => {
    v.onseeked = () => resolve();
    v.currentTime = t;
  });
}

function toWebp(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b && b.type === "image/webp" ? resolve(b) : reject(new Error("This browser cannot create WebP images. Use Chrome, Edge or Firefox."))), "image/webp", quality),
  );
}

export type FilmFrames = { frameCount: number; width: number; height: number; mobileWidth: number; mobileHeight: number; desktop: Blob[]; mobile: Blob[] };

export async function extractFrames(file: File, onProgress: Progress): Promise<FilmFrames> {
  if (file.size > 300 * 1024 * 1024) throw new Error("The video file is larger than 300 MB.");
  const v = await loadVideo(file);
  try {
    if (!Number.isFinite(v.duration) || v.duration < 1) throw new Error("The video is too short (at least 1 second).");
    const seconds = Math.min(v.duration, FILM_MAX_SECONDS);
    const frameCount = Math.max(12, Math.min(150, Math.round(seconds * FILM_FPS)));
    const ratio = v.videoHeight / v.videoWidth;
    const width = even(Math.min(DESKTOP_WIDTH, v.videoWidth));
    const height = even(width * ratio);
    const mobileWidth = even(Math.min(MOBILE_WIDTH, v.videoWidth));
    const mobileHeight = even(mobileWidth * ratio);
    const big = Object.assign(document.createElement("canvas"), { width, height });
    const small = Object.assign(document.createElement("canvas"), { width: mobileWidth, height: mobileHeight });
    const desktop: Blob[] = [];
    const mobile: Blob[] = [];
    for (let i = 0; i < frameCount; i++) {
      await seek(v, (i / (frameCount - 1)) * (seconds - 0.05));
      big.getContext("2d")!.drawImage(v, 0, 0, width, height);
      small.getContext("2d")!.drawImage(v, 0, 0, mobileWidth, mobileHeight);
      desktop.push(await toWebp(big, 0.72));
      mobile.push(await toWebp(small, 0.7));
      onProgress("Preparing frames", i + 1, frameCount);
    }
    return { frameCount, width, height, mobileWidth, mobileHeight, desktop, mobile };
  } finally {
    URL.revokeObjectURL(v.src);
  }
}

async function call<T>(url: string, init: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(res.status === 401 ? "Your session expired. Sign in again." : (body.error ?? "Upload failed. Try again."));
  return body;
}

export type UploadedFilm = { id: string; frameCount: number; width: number; height: number; mobileWidth: number; mobileHeight: number; pattern: string };

/** Uploads the frames in small batches and finalizes the film. */
export async function uploadFilm(file: File, frames: FilmFrames, onProgress: Progress): Promise<UploadedFilm> {
  const { id } = await call<{ id: string }>("/api/admin/sequences", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ frameCount: frames.frameCount, width: frames.width, height: frames.height, mobileWidth: frames.mobileWidth, mobileHeight: frames.mobileHeight, originalName: file.name.slice(0, 200) }),
  });
  const n = (i: number) => String(i).padStart(4, "0");
  for (let start = 0; start < frames.frameCount; start += 8) {
    const form = new FormData();
    for (let i = start; i < Math.min(start + 8, frames.frameCount); i++) {
      form.append(`d-${n(i)}`, new File([frames.desktop[i]], `d-${n(i)}.webp`, { type: "image/webp" }));
      form.append(`m-${n(i)}`, new File([frames.mobile[i]], `m-${n(i)}.webp`, { type: "image/webp" }));
    }
    await call(`/api/admin/sequences/${id}/frames`, { method: "POST", body: form });
    onProgress("Uploading", Math.min(start + 8, frames.frameCount), frames.frameCount);
  }
  const { sequence } = await call<{ sequence: UploadedFilm }>(`/api/admin/sequences/${id}/finalize`, { method: "POST" });
  return sequence;
}
