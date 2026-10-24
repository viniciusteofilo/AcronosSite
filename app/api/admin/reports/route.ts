import type { NextRequest } from "next/server";
import { getDb } from "@/db/client";
import { getAccessContext } from "@/server/auth";
import { AccessDeniedError } from "@/server/rbac/access";
import { ordersCsv } from "@/server/reports/sales";

/** Paid orders of a period as CSV (reports:export). */
export async function GET(request: NextRequest) {
  try {
    const { csv, filename } = await ordersCsv(getDb(), await getAccessContext(), {
      from: request.nextUrl.searchParams.get("from") ?? undefined,
      to: request.nextUrl.searchParams.get("to") ?? undefined,
    });
    return new Response(`﻿${csv}`, {
      headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${filename}"`, "cache-control": "no-store" },
    });
  } catch (e) {
    if (e instanceof AccessDeniedError) return Response.json({ error: "Not allowed" }, { status: e.reason === "unauthenticated" ? 401 : 403 });
    throw e;
  }
}
