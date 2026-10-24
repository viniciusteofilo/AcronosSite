import type { Database } from "@/db/client";
import { auditLogs } from "@/db/schema";

export type AuditEntry = {
  actorId: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  ipAddress?: string | null;
};

type Executor = Pick<Database, "insert">;

/** Writes one immutable audit record. Pass the transaction to keep it atomic with the change. */
export async function recordAudit(db: Executor, entry: AuditEntry): Promise<void> {
  await db.insert(auditLogs).values({
    actorId: entry.actorId,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId ?? null,
    before: entry.before ?? null,
    after: entry.after ?? null,
    ipAddress: entry.ipAddress ?? null,
  });
}
