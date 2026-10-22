import { getDb } from "@/db/client";
import { sameOrigin, staffApi } from "@/server/auth/api";
import { runAdmin } from "@/server/admin/errors";
import { SEQUENCE_LIMITS, uploadSequenceFrames } from "@/server/media/sequences";

/** A batch of frames (multipart, field names d-NNNN / m-NNNN). */
export async function POST(request: Request, { params }: RouteContext<"/api/admin/sequences/[id]/frames">) {
  if (!sameOrigin(request)) return Response.json({ error: "Invalid origin" }, { status: 403 });
  const auth = await staffApi("content:write");
  if ("error" in auth) return auth.error;
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > SEQUENCE_LIMITS.maxFrameBytes * SEQUENCE_LIMITS.maxBatch + 64 * 1024) return Response.json({ error: "Batch too large" }, { status: 413 });
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "Invalid upload" }, { status: 400 });
  }
  const files: { name: string; bytes: Uint8Array }[] = [];
  for (const [name, value] of form.entries()) {
    if (value instanceof File) files.push({ name, bytes: new Uint8Array(await value.arrayBuffer()) });
  }
  const { id } = await params;
  const r = await runAdmin(() => uploadSequenceFrames(getDb(), auth.ctx, id, files), "ok");
  return r.ok ? Response.json({ ok: true }) : Response.json({ error: r.message }, { status: 422 });
}
