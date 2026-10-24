"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { getDb } from "@/db/client";
import { deleteAddress, getProfile, saveAddress, updateName } from "@/server/account/profile";
import { UserError } from "@/server/admin/errors";
import { getAuth } from "@/server/auth";
import { emailAvailable, sendEmail } from "@/server/email/send";
import { passwordChangedMessage } from "@/server/email/templates";
import { takeRateLimit } from "@/server/security/rate-limit";
import { getAccessContext } from "@/server/auth";
import { runAdmin } from "@/server/admin/errors";
import { endOtherSessions, endSession, requestAccountDeletion } from "@/server/account/self-service";

export async function endOtherSessionsAction() {
  return runAdmin(async () => endOtherSessions(getDb(), await getAccessContext()), (n) => (n ? `Signed out of ${n} other session(s).` : "No other sessions."));
}
export async function endSessionAction(id: string) {
  return runAdmin(async () => endSession(getDb(), await getAccessContext(), id), "Session ended.");
}
export async function requestDeletionAction() {
  return runAdmin(async () => requestAccountDeletion(getDb(), await getAccessContext()), (r) =>
    r.alreadyRequested ? "Your request is already being handled." : "Request received. We will erase your data and confirm by e-mail within 15 days.",
  );
}

// ── profile, addresses, password ─────────────────────────────────────────────────────────────

export async function updateNameAction(name: string) {
  return runAdmin(async () => updateName(getDb(), await getAccessContext(), name), "Name saved.");
}
export async function saveAddressAction(input: unknown) {
  return runAdmin(async () => saveAddress(getDb(), await getAccessContext(), input), "Address saved.");
}
export async function deleteAddressAction(id: string) {
  return runAdmin(async () => deleteAddress(getDb(), await getAccessContext(), id), "Address removed.");
}

export async function resendVerificationAction() {
  return runAdmin(async () => {
    const db = getDb();
    const ctx = await getAccessContext();
    const profile = await getProfile(db, ctx);
    if (profile.emailVerified) throw new UserError("Your e-mail is already confirmed.");
    if (!emailAvailable()) throw new UserError("E-mail is not available yet. Try again later.");
    if (!(await takeRateLimit(db, `verify:${ctx!.userId}`, 3, 600))) throw new UserError("We already sent a few links. Wait a few minutes.");
    await getAuth().api.sendVerificationEmail({ body: { email: profile.email, callbackURL: "/account?verified=1" } });
  }, "We sent a new link. Check your inbox and spam folder.");
}

const passwordInput = z.object({
  currentPassword: z.string().min(1, "Enter your current password.").max(128),
  newPassword: z.string().min(12, "Use at least 12 characters.").max(128),
});

/** Changes the password, signs out every other device and e-mails a notice. */
export async function changePasswordAction(input: unknown) {
  return runAdmin(async () => {
    const db = getDb();
    const ctx = await getAccessContext();
    const profile = await getProfile(db, ctx);
    const body = passwordInput.parse(input);
    if (!(await takeRateLimit(db, `password:${ctx!.userId}`, 5, 600))) throw new UserError("Too many attempts. Wait a few minutes.");
    try {
      await getAuth().api.changePassword({ body: { ...body, revokeOtherSessions: true }, headers: await headers() });
    } catch {
      throw new UserError("Your current password is not correct.");
    }
    await sendEmail(db, { kind: "password_changed", to: profile.email, ref: ctx!.userId, ...passwordChangedMessage(profile.name) });
  }, "Password changed. Other devices were signed out.");
}
