import { AccessDeniedError, decideStaffAccess, type AccessContext } from "@/server/rbac/access";
import type { Permission } from "@/server/rbac/permissions";

/** An error whose message is safe and useful to show to the person using the admin. */
export class UserError extends Error {
  constructor(
    message: string,
    public readonly field?: string,
  ) {
    super(message);
    this.name = "UserError";
  }
}

/** Throws unless the actor is staff with MFA, a fresh session and this permission. */
export function authorize(actor: AccessContext | null, permission: Permission): AccessContext {
  const d = decideStaffAccess(actor, permission);
  if (!d.ok) throw new AccessDeniedError(d.reason);
  return d.ctx;
}

export type ActionResult<T = undefined> =
  | { ok: true; message: string; data?: T }
  | { ok: false; message: string; field?: string };

/** Postgres error code (e.g. 23505 unique violation) from a driver error or its cause chain. */
export function pgCode(e: unknown): { code?: string; constraint?: string } {
  let err: unknown = e;
  while (err && typeof err === "object") {
    if ("code" in err && typeof err.code === "string" && /^[0-9A-Z]{5}$/.test(err.code)) {
      return { code: err.code, constraint: "constraint_name" in err ? String(err.constraint_name) : undefined };
    }
    err = "cause" in err ? err.cause : undefined;
  }
  return {};
}

/**
 * Runs an admin operation and turns any failure into a message for the screen.
 * Internal errors are logged on the server and never shown verbatim.
 */
export async function runAdmin<T>(fn: () => Promise<T>, success: string | ((v: T) => string)): Promise<ActionResult<T>> {
  try {
    const value = await fn();
    return { ok: true, message: typeof success === "string" ? success : success(value), data: value };
  } catch (e) {
    if (e instanceof UserError) return { ok: false, message: e.message, field: e.field };
    if (e instanceof AccessDeniedError) {
      return {
        ok: false,
        message: e.reason === "forbidden" ? "Your role does not allow this action." : "Your session expired. Sign in again.",
      };
    }
    if (e instanceof Error && e.name === "ZodError" && "issues" in e && Array.isArray(e.issues)) {
      const issue = e.issues[0] as { path?: (string | number)[]; message?: string } | undefined;
      const where = issue?.path?.length ? `${issue.path.join(" › ")}: ` : "";
      return { ok: false, message: `${where}${issue?.message ?? "Check the form."}`, field: issue?.path?.join(".") };
    }
    const { code, constraint } = pgCode(e);
    if (code === "23505") {
      const what = constraint?.includes("sku") ? "SKU" : constraint?.includes("slug") ? "web address (slug)" : "value";
      return { ok: false, message: `That ${what} is already in use. Choose another one.` };
    }
    if (code === "23514" && constraint?.includes("reserved_within_on_hand")) {
      return { ok: false, message: "Stock cannot go below the units already reserved by open orders." };
    }
    if (code === "23514" && constraint?.includes("on_hand_non_negative")) {
      return { ok: false, message: "Stock cannot be negative." };
    }
    console.error("[admin action]", e);
    return { ok: false, message: "Something went wrong and nothing was saved. Try again." };
  }
}
