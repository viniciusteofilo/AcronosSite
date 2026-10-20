import { index, integer, jsonb, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./auth";
import { mediaAssets } from "./commerce";

export const CONTENT_STATUS = ["draft", "scheduled", "published", "archived"] as const;

const timestamps = {
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
};

/**
 * Pages edited in the admin (homepage campaign, About, Lab, policies). Three copies of the
 * content let ACRONOS prepare the next campaign without touching what is live:
 *   blocks          what visitors see now
 *   draftBlocks     work in progress (null = no pending edits)
 *   scheduledBlocks goes live automatically at scheduledAt
 */
export const pages = pgTable("pages", {
  id: uuid().primaryKey().defaultRandom(),
  slug: text().notNull().unique(),
  locale: text().notNull().default("en-US"),
  title: text().notNull(),
  blocks: jsonb().notNull().default({}),
  draftBlocks: jsonb(),
  scheduledBlocks: jsonb(),
  scheduledAt: timestamp({ withTimezone: true }),
  status: text({ enum: CONTENT_STATUS }).notNull().default("draft"),
  publishAt: timestamp({ withTimezone: true }),
  updatedBy: uuid().references(() => users.id, { onDelete: "set null" }),
  seoTitle: text(),
  seoDescription: text(),
  ...timestamps,
});

/** Full snapshot of any CMS entity on every save: change history and restore. */
export const contentRevisions = pgTable(
  "content_revisions",
  {
    id: uuid().primaryKey().defaultRandom(),
    entityType: text({ enum: ["page", "story", "lab_project", "lab_update"] }).notNull(),
    entityId: uuid().notNull(),
    snapshot: jsonb().notNull(),
    authorId: uuid().references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index().on(t.entityType, t.entityId, t.createdAt)],
);

// ---------------------------------------------------------------- ACRONOS SCI-FI

export const storyCategories = pgTable("story_categories", {
  id: uuid().primaryKey().defaultRandom(),
  slug: text().notNull().unique(),
  name: text().notNull(),
});

export const stories = pgTable(
  "stories",
  {
    id: uuid().primaryKey().defaultRandom(),
    slug: text().notNull().unique(),
    locale: text().notNull().default("en-US"),
    title: text().notNull(),
    synopsis: text(),
    authorName: text().notNull(),
    coverImageId: uuid().references(() => mediaAssets.id, { onDelete: "set null" }),
    body: text().notNull().default(""), // sanitized HTML, sanitized on save and on render
    readingMinutes: integer(),
    status: text({ enum: CONTENT_STATUS }).notNull().default("draft"),
    publishAt: timestamp({ withTimezone: true }),
    publishedAt: timestamp({ withTimezone: true }),
    importedFrom: text(), // provenance when imported from the old site; never invented
    seoTitle: text(),
    seoDescription: text(),
    ...timestamps,
  },
  (t) => [index().on(t.status, t.publishedAt)],
);

export const storyCategoryLinks = pgTable(
  "story_category_links",
  {
    storyId: uuid()
      .notNull()
      .references(() => stories.id, { onDelete: "cascade" }),
    categoryId: uuid()
      .notNull()
      .references(() => storyCategories.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.storyId, t.categoryId] })],
);

// ---------------------------------------------------------------- ACRONOS LAB (in planning)

export const LAB_STATUS = ["planned", "in_progress", "completed", "paused"] as const;

export const labProjects = pgTable("lab_projects", {
  id: uuid().primaryKey().defaultRandom(),
  slug: text().notNull().unique(),
  title: text().notNull(),
  summary: text(),
  body: text().notNull().default(""),
  initiativeStatus: text({ enum: LAB_STATUS }).notNull().default("planned"),
  status: text({ enum: CONTENT_STATUS }).notNull().default("draft"),
  ...timestamps,
});

export const labUpdates = pgTable("lab_updates", {
  id: uuid().primaryKey().defaultRandom(),
  projectId: uuid().references(() => labProjects.id, { onDelete: "set null" }),
  slug: text().notNull().unique(),
  title: text().notNull(),
  body: text().notNull().default(""),
  status: text({ enum: CONTENT_STATUS }).notNull().default("draft"),
  publishAt: timestamp({ withTimezone: true }),
  ...timestamps,
});

// ---------------------------------------------------------------- marketing & privacy

export const newsletterSubscribers = pgTable("newsletter_subscribers", {
  id: uuid().primaryKey().defaultRandom(),
  email: text().notNull().unique(),
  status: text({ enum: ["pending", "confirmed", "unsubscribed"] }).notNull().default("pending"),
  consentSource: text().notNull(),
  consentAt: timestamp({ withTimezone: true }),
  unsubscribedAt: timestamp({ withTimezone: true }),
  ...timestamps,
});

export const privacyRequests = pgTable("privacy_requests", {
  id: uuid().primaryKey().defaultRandom(),
  userId: uuid().references(() => users.id, { onDelete: "set null" }),
  email: text().notNull(),
  kind: text({ enum: ["export", "delete", "correct"] }).notNull(),
  status: text({ enum: ["received", "in_progress", "completed", "rejected"] })
    .notNull()
    .default("received"),
  handledBy: uuid().references(() => users.id, { onDelete: "set null" }),
  completedAt: timestamp({ withTimezone: true }),
  ...timestamps,
});

/** Messages from the contact form and customer support requests. */
export const supportRequests = pgTable("support_requests", {
  id: uuid().primaryKey().defaultRandom(),
  userId: uuid().references(() => users.id, { onDelete: "set null" }),
  name: text().notNull(),
  email: text().notNull(),
  topic: text({ enum: ["order", "product", "wholesale", "press", "lab", "other"] }).notNull(),
  message: text().notNull(),
  status: text({ enum: ["new", "open", "closed"] }).notNull().default("new"),
  ...timestamps,
});

export const settings = pgTable("settings", {
  key: text().primaryKey(),
  value: jsonb().notNull(),
  updatedBy: uuid().references(() => users.id, { onDelete: "set null" }),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});
