import { getMediaStorage, MEDIA_KEY_PATTERN } from "@/server/media/storage";

/**
 * Serves uploaded images in development (local disk). In production the files are served
 * straight from Cloudflare R2 via NEXT_PUBLIC_MEDIA_BASE_URL and this route is not used.
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
