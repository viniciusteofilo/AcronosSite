import { getDb } from "@/db/client";
import { exportMyData } from "@/server/account/self-service";
import { getAccessContext } from "@/server/auth";

/** "Download my data": a JSON file with everything stored about the signed-in person. */
export async function GET() {
  const ctx = await getAccessContext();
  if (!ctx) return Response.json({ error: "Sign in first" }, { status: 401 });
  const data = await exportMyData(getDb(), ctx);
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="acronos-my-data-${new Date().toISOString().slice(0, 10)}.json"`,
      "cache-control": "no-store",
    },
  });
}
