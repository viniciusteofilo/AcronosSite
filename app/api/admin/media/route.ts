import { getDb } from "@/db/client";
import { sameOrigin, staffApi } from "@/server/auth/api";
import { createMediaAsset, MAX_RENDITION_BYTES, UploadError } from "@/server/media/library";
import { AccessDeniedError } from "@/server/rbac/access";

/** Upload: multipart form with up to 3 WebP files ("file") plus "alt" and "originalName". */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Invalid origin" }, { status: 403 });
  const auth = await staffApi("content:write");
  if ("error" in auth) return auth.error;

  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_RENDITION_BYTES * 3 + 64 * 1024) return Response.json({ error: "Upload too large" }, { status: 413 });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "Invalid upload" }, { status: 400 });
  }
  const files = form.getAll("file").filter((f): f is File => f instanceof File);
  try {
    const media = await createMediaAsset(getDb(), auth.ctx, {
      files: await Promise.all(files.map(async (f) => new Uint8Array(await f.arrayBuffer()))),
      meta: { alt: form.get("alt") ?? "", originalName: String(form.get("originalName") ?? "").slice(0, 200) || undefined },
    });
    return Response.json({ media }, { status: 201 });
  } catch (e) {
    if (e instanceof UploadError) return Response.json({ error: e.message }, { status: 422 });
    if (e instanceof AccessDeniedError) return Response.json({ error: e.reason }, { status: 403 });
    throw e;
  }
}
