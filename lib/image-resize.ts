"use client";

/**
 * Turns any photo the editor picks (JPEG, PNG, WebP, AVIF, HEIC where the browser supports it)
 * into up to three WebP sizes for phones, laptops and large screens. Done in the browser,
 * so uploads are small and the server never runs an image library.
 */
export const TARGET_WIDTHS = [640, 1280, 2400];
export const MAX_INPUT_BYTES = 40 * 1024 * 1024;

export async function resizeForWeb(file: File, quality = 0.84): Promise<{ blobs: Blob[]; width: number; height: number }> {
  if (!file.type.startsWith("image/")) throw new Error("Choose an image file (JPG, PNG or WebP).");
  if (file.size > MAX_INPUT_BYTES) throw new Error("This image is larger than 40 MB. Export a smaller version and try again.");
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("This image format cannot be read by the browser. Export it as JPG or PNG.");
  }
  const { width, height } = bitmap;
  if (width < 400) throw new Error("This image is too small (minimum 400 px wide).");
  const widths = TARGET_WIDTHS.filter((w) => w < width);
  widths.push(Math.min(width, TARGET_WIDTHS.at(-1)!));
  const unique = [...new Set(widths)].slice(-3);

  const blobs: Blob[] = [];
  for (const w of unique) {
    const h = Math.round((height / width) * w);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Your browser could not process the image.");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", quality));
    if (!blob || blob.type !== "image/webp") throw new Error("Your browser cannot create WebP images. Try Chrome, Edge, Firefox or Safari 16+.");
    blobs.push(blob);
  }
  bitmap.close();
  return { blobs, width, height };
}
