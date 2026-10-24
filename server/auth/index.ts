import "server-only";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getDb } from "@/db/client";
import {
  decideStaffAccess,
  loadAccessContext,
  type AccessContext,
} from "@/server/rbac/access";
import type { Permission } from "@/server/rbac/permissions";
import { createAuth, type Auth } from "./auth";

const globalForAuth = globalThis as unknown as { acronosAuth?: Auth };

export function getAuth(): Auth {
  if (!globalForAuth.acronosAuth) globalForAuth.acronosAuth = createAuth(getDb());
  return globalForAuth.acronosAuth;
}

/** Reads the current session from the request cookies and resolves roles from the database. */
export async function getAccessContext(): Promise<AccessContext | null> {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) return null;
  return loadAccessContext(getDb(), {
    userId: session.user.id,
    createdAt: new Date(session.session.createdAt),
    id: session.session.id,
  });
}

/**
 * Server-side gate for every admin page and action. Hiding a link is not protection;
 * this check runs on the server for each request.
 */
export async function requireStaff(permission: Permission | null = null): Promise<AccessContext> {
  const decision = decideStaffAccess(await getAccessContext(), permission);
  if (decision.ok) return decision.ctx;
  switch (decision.reason) {
    case "unauthenticated":
    case "session_too_old":
      redirect("/login?next=/admin");
    case "mfa_required":
      redirect("/account/security?required=mfa");
    case "not_staff":
    case "forbidden":
      // Answer 404, not 403: the admin area does not confirm its own existence to outsiders.
      notFound();
  }
}

export async function requireUser(next = "/account"): Promise<AccessContext> {
  const ctx = await getAccessContext();
  if (!ctx) redirect(`/login?next=${encodeURIComponent(next)}`);
  return ctx;
}
