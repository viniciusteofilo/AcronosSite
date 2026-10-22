import { getDb } from "@/db/client";
import { sameOrigin, staffApi } from "@/server/auth/api";
import { runAdmin } from "@/server/admin/errors";
import { finalizeSequence } from "@/server/media/sequences";

export async function POST(request: Request, { params }: RouteContext<"/api/admin/sequences/[id]/finalize">) {
  if (!sameOrigin(request)) return Response.json({ error: "Invalid origin" }, { status: 403 });
  const auth = await staffApi("content:write");
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const r = await runAdmin(() => finalizeSequence(getDb(), auth.ctx, id), "ok");
  return r.ok ? Response.json({ sequence: r.data }) : Response.json({ error: r.message }, { status: 422 });
}
