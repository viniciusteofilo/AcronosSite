import { bigserial, index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./auth";

/**
 * Append-only audit trail. A database trigger (see migrations) rejects UPDATE and DELETE,
 * so not even an application bug or a compromised admin session can rewrite history.
 */
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: bigserial({ mode: "number" }).primaryKey(),
    actorId: uuid().references(() => users.id, { onDelete: "set null" }),
    action: text().notNull(),
    entityType: text().notNull(),
    entityId: text(),
    before: jsonb(),
    after: jsonb(),
    ipAddress: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index().on(t.entityType, t.entityId), index().on(t.actorId), index().on(t.createdAt)],
);
