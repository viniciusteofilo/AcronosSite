import "server-only";
import { decideStaffAccess, type AccessContext } from "@/server/rbac/access";
import type { Permission } from "@/server/rbac/permissions";
import { getAccessContext } from "./index";

/**
 * Staff check for Route Handlers: returns the context, or a JSON error response
 * (401 not signed in, 403 everything else). Never redirects from an API.
 */
export async function staffApi(permission: Permission): Promise<{ ctx: AccessContext } | { error: Response }> {
  const decision = decideStaffAccess(await getAccessContext(), permission);
  if (decision.ok) return { ctx: decision.ctx };
  const status = decision.reason === "unauthenticated" || decision.reason === "session_too_old" ? 401 : 403;
  return { error: Response.json({ error: decision.reason }, { status }) };
}

/** Rejects cross-site requests to state-changing APIs (CSRF defense in addition to SameSite cookies). */
export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  const expected = new URL(process.env.BETTER_AUTH_URL ?? request.url).origin;
  return origin === expected;
}
