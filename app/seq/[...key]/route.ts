import { getMediaStorage, SEQUENCE_KEY_PATTERN } from "@/server/media/storage";

/** Frames of scroll films. Immutable (a new film gets a new id), cached for a year. */
export async function GET(_request: Request, { params }: RouteContext<"/seq/[...key]">) {
  const key = `seq/${(await params).key.join("/")}`;
  if (!SEQUENCE_KEY_PATTERN.test(key)) return new Response("Not found", { status: 404 });
  const file = await getMediaStorage().get(key);
  if (!file) return new Response("Not found", { status: 404 });
  return new Response(file.bytes as unknown as BodyInit, {
    headers: { "Content-Type": "image/webp", "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" },
  });
}
