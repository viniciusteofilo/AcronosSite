import { getDb } from "@/db/client";
import { sameOrigin, staffApi } from "@/server/auth/api";
import { runAdmin } from "@/server/admin/errors";
import { createSequence } from "@/server/media/sequences";

/** Starts a scroll film upload: { frameCount, width, height, mobileWidth, mobileHeight, originalName }. */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Invalid origin" }, { status: 403 });
  const auth = await staffApi("content:write");
  if ("error" in auth) return auth.error;
  const body = await request.json().catch(() => null);
  const r = await runAdmin(() => createSequence(getDb(), auth.ctx, body), "ok");
  return r.ok ? Response.json(r.data, { status: 201 }) : Response.json({ error: r.message }, { status: 422 });
}
