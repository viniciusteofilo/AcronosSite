import { getDb } from "@/db/client";
import { exportSubscribersCsv } from "@/server/admin/people";
import { getAccessContext } from "@/server/auth";
import { AccessDeniedError } from "@/server/rbac/access";

/** Newsletter CSV download for staff with marketing:write. Never cached. */
export async function GET() {
  try {
    const csv = await exportSubscribersCsv(getDb(), await getAccessContext());
    const date = new Date().toISOString().slice(0, 10);
    return new Response(`﻿${csv}`, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="acronos-newsletter-${date}.csv"`,
        "cache-control": "no-store",
      },
    });
  } catch (e) {
    if (e instanceof AccessDeniedError) return Response.json({ error: "Not allowed" }, { status: e.reason === "unauthenticated" ? 401 : 403 });
    throw e;
  }
}
