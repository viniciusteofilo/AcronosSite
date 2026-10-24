"use server";

import { getDb } from "@/db/client";
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
