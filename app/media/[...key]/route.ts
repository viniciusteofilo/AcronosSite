import { getMediaStorage, MEDIA_KEY_PATTERN } from "@/server/media/storage";

/**
 * Serves uploaded images: from the local disk in development and from the R2 bucket on
 * Cloudflare. Files never change (new upload = new key), so browsers and the CDN cache them for a year.
 */
export async function GET(_request: Request, { params }: RouteContext<"/media/[...key]">) {
  const key = `media/${(await params).key.join("/")}`;
  if (!MEDIA_KEY_PATTERN.test(key)) return new Response("Not found", { status: 404 });
  const file = await getMediaStorage().get(key);
  if (!file) return new Response("Not found", { status: 404 });
  return new Response(file.bytes as unknown as BodyInit, {
    headers: {
      "Content-Type": file.contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
