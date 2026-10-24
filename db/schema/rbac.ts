import { pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./auth";

/**
 * Roles are stored per user. The permissions each role grants live in code
 * (server/rbac/permissions.ts) so they are reviewed in pull requests and covered by tests.
 * Customers have no row here: an authenticated user without roles is a customer.
 */
export const ROLE_KEYS = ["super_admin", "manager", "content_editor", "order_manager"] as const;
export type RoleKey = (typeof ROLE_KEYS)[number];

export const userRoles = pgTable(
  "user_roles",
  {
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text({ enum: ROLE_KEYS }).notNull(),
    grantedBy: uuid().references(() => users.id, { onDelete: "set null" }),
    grantedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.role] })],
);
