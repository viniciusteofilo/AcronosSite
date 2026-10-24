import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const EMAIL_KINDS = [
  "verify_email",
  "reset_password",
  "password_changed",
  "change_email",
  "order_confirmation",
  "order_shipped",
  "order_refunded",
  "newsletter_confirm",
  "contact_notification",
  "staff_sign_in",
  "test",
] as const;

/**
 * Every e-mail the store tries to send. With a provider connected only the metadata is kept
 * (no message bodies with personal links). Without a provider, on the test environment or in
 * development, the full message is kept so the team can see it in the admin ("not sent").
 */
export const emailLog = pgTable(
  "email_log",
  {
    id: uuid().primaryKey().defaultRandom(),
    kind: text({ enum: EMAIL_KINDS }).notNull(),
    to: text().notNull(),
    subject: text().notNull(),
    status: text({ enum: ["sent", "failed", "not_sent"] }).notNull(),
    provider: text(),
    providerId: text(),
    error: text(),
    /** Related record, e.g. an order id. */
    ref: text(),
    bodyHtml: text(),
    bodyText: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index().on(t.createdAt), index().on(t.to)],
);
