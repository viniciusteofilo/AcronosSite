import { and, asc, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "@/db/client";
import { contentRevisions, labProjects, labUpdates, LAB_STATUS, stories, storyCategories, storyCategoryLinks, users } from "@/db/schema";
import { SLUG_PATTERN } from "@/lib/slug";
import { UserError, authorize } from "@/server/admin/errors";
import { recordAudit } from "@/server/audit/log";
import { getMediaByIds, type MediaView } from "@/server/media/library";
import type { AccessContext } from "@/server/rbac/access";
import { sanitizeStoryHtml } from "./stories";

const slug = z.string().trim().toLowerCase().min(2, "Web address is too short").max(80).regex(SLUG_PATTERN, "Web address: use lowercase letters, numbers and hyphens");
const opt = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => v || null)
    .nullable()
    .default(null);

export const STORY_STATUS = ["draft", "scheduled", "published", "archived"] as const;

const storyInput = z.object({
  id: z.uuid().optional(),
  expectedUpdatedAt: z.string().optional(),
  title: z.string().trim().min(1, "Title is required").max(160),
  slug,
  authorName: z.string().trim().min(1, "Author is required").max(120),
  synopsis: opt(600),
  coverImageId: z.uuid().nullable().default(null),
  body: z.string().max(400_000, "The story is too long for one page (400k characters)"),
  status: z.enum(STORY_STATUS),
  publishAt: z.iso.datetime({ offset: true }).nullable().default(null),
  categoryIds: z.array(z.uuid()).max(10).default([]),
  importedFrom: opt(200),
  seoTitle: opt(70),
  seoDescription: opt(170),
});

const words = (html: string) => html.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;

export async function listStoriesAdmin(db: Database, actor: AccessContext | null) {
  authorize(actor, "content:write");
  const rows = await db
    .select({
      id: stories.id,
      title: stories.title,
      slug: stories.slug,
      authorName: stories.authorName,
      status: stories.status,
      publishAt: stories.publishAt,
      publishedAt: stories.publishedAt,
      updatedAt: stories.updatedAt,
      coverImageId: stories.coverImageId,
      chars: sql<number>`length(${stories.body})`,
    })
    .from(stories)
    .orderBy(desc(stories.updatedAt));
  const media = await getMediaByIds(db, rows.map((r) => r.coverImageId).filter((v): v is string => Boolean(v)));
  return rows.map((r) => ({
    ...r,
    publishAt: r.publishAt?.toISOString() ?? null,
    publishedAt: r.publishedAt?.toISOString() ?? null,
    updatedAt: r.updatedAt.toISOString(),
    cover: r.coverImageId ? (media.get(r.coverImageId) ?? null) : null,
  }));
}

export type EditorStory = {
  id: string;
  updatedAt: string;
  title: string;
  slug: string;
  authorName: string;
  synopsis: string;
  cover: MediaView | null;
  body: string;
  status: (typeof STORY_STATUS)[number];
  publishAt: string | null;
  categoryIds: string[];
  importedFrom: string;
  seoTitle: string;
  seoDescription: string;
  revisions: { id: string; createdAt: string; author: string | null }[];
};

export async function getStoryForEditor(db: Database, actor: AccessContext | null, id: string): Promise<EditorStory | null> {
  authorize(actor, "content:write");
  if (!z.uuid().safeParse(id).success) return null;
  const [s] = await db.select().from(stories).where(eq(stories.id, id)).limit(1);
  if (!s) return null;
  const [cats, revs, media] = await Promise.all([
    db.select({ id: storyCategoryLinks.categoryId }).from(storyCategoryLinks).where(eq(storyCategoryLinks.storyId, id)),
    db
      .select({ id: contentRevisions.id, createdAt: contentRevisions.createdAt, author: users.email })
      .from(contentRevisions)
      .leftJoin(users, eq(users.id, contentRevisions.authorId))
      .where(and(eq(contentRevisions.entityType, "story"), eq(contentRevisions.entityId, id)))
      .orderBy(desc(contentRevisions.createdAt))
      .limit(20),
    s.coverImageId ? getMediaByIds(db, [s.coverImageId]) : Promise.resolve(new Map<string, MediaView>()),
  ]);
  return {
    id: s.id,
    updatedAt: s.updatedAt.toISOString(),
    title: s.title,
    slug: s.slug,
    authorName: s.authorName,
    synopsis: s.synopsis ?? "",
    cover: s.coverImageId ? (media.get(s.coverImageId) ?? null) : null,
    body: sanitizeStoryHtml(s.body),
    status: s.status,
    publishAt: s.publishAt?.toISOString() ?? null,
    categoryIds: cats.map((c) => c.id),
    importedFrom: s.importedFrom ?? "",
    seoTitle: s.seoTitle ?? "",
    seoDescription: s.seoDescription ?? "",
    revisions: revs.map((r) => ({ id: r.id, createdAt: r.createdAt.toISOString(), author: r.author })),
  };
}

/**
 * Saves a story. The body is sanitized here (only basic formatting survives), the previous
 * version is kept in the history, and "scheduled" needs a future date.
 */
export async function saveStory(db: Database, actor: AccessContext | null, raw: unknown, now: Date = new Date()) {
  const ctx = authorize(actor, "content:write");
  const input = storyInput.parse(raw);
  const body = sanitizeStoryHtml(input.body).replace(/<p>(\s|&nbsp;|<br\s*\/?>)*<\/p>/g, "").trim();
  const publishAt = input.publishAt ? new Date(input.publishAt) : null;
  if (input.status === "scheduled" && (!publishAt || publishAt <= now)) {
    throw new UserError("To schedule, choose a future date and time.", "publishAt");
  }
  if ((input.status === "published" || input.status === "scheduled") && words(body) < 1) {
    throw new UserError("The story has no text yet.", "body");
  }
  return db.transaction(async (tx) => {
    let before: typeof stories.$inferSelect | undefined;
    if (input.id) {
      [before] = await tx.select().from(stories).where(eq(stories.id, input.id)).for("update");
      if (!before) throw new UserError("This story no longer exists.");
      if (input.expectedUpdatedAt && before.updatedAt.toISOString() !== input.expectedUpdatedAt) {
        throw new UserError("Someone else saved this story after you opened it. Reload the page to see the latest version.");
      }
      await tx.insert(contentRevisions).values({ entityType: "story", entityId: before.id, snapshot: before, authorId: ctx.userId });
    }
    const values = {
      title: input.title,
      slug: input.slug,
      authorName: input.authorName,
      synopsis: input.synopsis,
      coverImageId: input.coverImageId,
      body,
      readingMinutes: Math.max(1, Math.round(words(body) / 230)),
      status: input.status,
      publishAt: input.status === "scheduled" ? publishAt : null,
      publishedAt: input.status === "published" ? (before?.publishedAt ?? now) : input.status === "scheduled" ? publishAt : (before?.publishedAt ?? null),
      importedFrom: input.importedFrom,
      seoTitle: input.seoTitle,
      seoDescription: input.seoDescription,
      updatedAt: now,
    };
    const [row] = before
      ? await tx.update(stories).set(values).where(eq(stories.id, before.id)).returning()
      : await tx.insert(stories).values(values).returning();
    await tx.delete(storyCategoryLinks).where(eq(storyCategoryLinks.storyId, row.id));
    const cats = [...new Set(input.categoryIds)];
    if (cats.length) await tx.insert(storyCategoryLinks).values(cats.map((categoryId) => ({ storyId: row.id, categoryId })));
    await recordAudit(tx, {
      actorId: ctx.userId,
      action: before ? "story.update" : "story.create",
      entityType: "story",
      entityId: row.id,
      before: before ? { title: before.title, status: before.status } : null,
      after: { title: row.title, status: row.status },
    });
    return { id: row.id, slug: row.slug };
  });
}

/** Loads an old version's fields for the editor (nothing changes until saved). */
export async function getStoryRevision(db: Database, actor: AccessContext | null, storyId: string, revisionId: string) {
  authorize(actor, "content:write");
  const [rev] = await db
    .select({ snapshot: contentRevisions.snapshot })
    .from(contentRevisions)
    .where(and(eq(contentRevisions.id, z.uuid().parse(revisionId)), eq(contentRevisions.entityId, z.uuid().parse(storyId)), eq(contentRevisions.entityType, "story")))
    .limit(1);
  if (!rev) throw new UserError("Version not found.");
  const s = rev.snapshot as Record<string, unknown>;
  const str = (k: string) => (typeof s[k] === "string" ? (s[k] as string) : "");
  return { title: str("title"), authorName: str("authorName"), synopsis: str("synopsis"), body: sanitizeStoryHtml(str("body")) };
}

export async function deleteStory(db: Database, actor: AccessContext | null, id: string) {
  const ctx = authorize(actor, "content:write");
  await db.transaction(async (tx) => {
    const [row] = await tx.delete(stories).where(eq(stories.id, z.uuid().parse(id))).returning();
    if (!row) throw new UserError("This story no longer exists.");
    await recordAudit(tx, { actorId: ctx.userId, action: "story.delete", entityType: "story", entityId: id, before: { title: row.title, slug: row.slug } });
  });
}

export async function listStoryCategories(db: Database, actor: AccessContext | null) {
  authorize(actor, "content:write");
  return db.select({ id: storyCategories.id, name: storyCategories.name, slug: storyCategories.slug }).from(storyCategories).orderBy(asc(storyCategories.name));
}

export async function createStoryCategory(db: Database, actor: AccessContext | null, raw: unknown) {
  const ctx = authorize(actor, "content:write");
  const input = z.object({ name: z.string().trim().min(2, "Name is required").max(60), slug }).parse(raw);
  const [row] = await db.insert(storyCategories).values(input).returning();
  await recordAudit(db, { actorId: ctx.userId, action: "story_category.create", entityType: "story_category", entityId: row.id, after: input });
  return { id: row.id, name: row.name, slug: row.slug };
}

// ---------------------------------------------------------------- Acronos Lab

const labProjectInput = z.object({
  id: z.uuid().optional(),
  title: z.string().trim().min(2, "Title is required").max(120),
  slug,
  summary: opt(600),
  body: z.string().trim().max(20_000).default(""),
  initiativeStatus: z.enum(LAB_STATUS),
  status: z.enum(["draft", "published", "archived"]),
});

const labUpdateInput = z.object({
  id: z.uuid().optional(),
  projectId: z.uuid().nullable().default(null),
  title: z.string().trim().min(2, "Title is required").max(160),
  slug,
  body: z.string().trim().max(20_000).default(""),
  status: z.enum(["draft", "published", "archived"]),
  publishAt: z.iso.datetime({ offset: true }).nullable().default(null),
});

export async function listLabAdmin(db: Database, actor: AccessContext | null) {
  authorize(actor, "content:write");
  const [projects, updates] = await Promise.all([
    db.select().from(labProjects).orderBy(desc(labProjects.updatedAt)),
    db.select().from(labUpdates).orderBy(desc(labUpdates.updatedAt)),
  ]);
  return {
    projects: projects.map((p) => ({ id: p.id, title: p.title, slug: p.slug, summary: p.summary ?? "", body: p.body, initiativeStatus: p.initiativeStatus, status: p.status as "draft" | "published" | "archived" })),
    updates: updates.map((u) => ({
      id: u.id,
      projectId: u.projectId,
      title: u.title,
      slug: u.slug,
      body: u.body,
      status: u.status as "draft" | "published" | "archived",
      publishAt: u.publishAt?.toISOString() ?? null,
    })),
  };
}

/** Lab content says only what ACRONOS confirms: a project's stage is chosen explicitly (default "planned"). */
export async function saveLabProject(db: Database, actor: AccessContext | null, raw: unknown) {
  const ctx = authorize(actor, "content:write");
  const input = labProjectInput.parse(raw);
  const { id, ...values } = input;
  return db.transaction(async (tx) => {
    const [row] = id
      ? await tx.update(labProjects).set({ ...values, updatedAt: new Date() }).where(eq(labProjects.id, id)).returning()
      : await tx.insert(labProjects).values(values).returning();
    if (!row) throw new UserError("This project no longer exists.");
    await recordAudit(tx, { actorId: ctx.userId, action: id ? "lab_project.update" : "lab_project.create", entityType: "lab_project", entityId: row.id, after: { title: row.title, status: row.status, stage: row.initiativeStatus } });
    return { id: row.id };
  });
}

export async function saveLabUpdate(db: Database, actor: AccessContext | null, raw: unknown) {
  const ctx = authorize(actor, "content:write");
  const input = labUpdateInput.parse(raw);
  const { id, publishAt, ...rest } = input;
  const values = { ...rest, publishAt: publishAt ? new Date(publishAt) : null };
  return db.transaction(async (tx) => {
    const [row] = id
      ? await tx.update(labUpdates).set({ ...values, updatedAt: new Date() }).where(eq(labUpdates.id, id)).returning()
      : await tx.insert(labUpdates).values(values).returning();
    if (!row) throw new UserError("This update no longer exists.");
    await recordAudit(tx, { actorId: ctx.userId, action: id ? "lab_update.update" : "lab_update.create", entityType: "lab_update", entityId: row.id, after: { title: row.title, status: row.status } });
    return { id: row.id };
  });
}

export async function deleteLabItem(db: Database, actor: AccessContext | null, kind: "project" | "update", id: string) {
  const ctx = authorize(actor, "content:write");
  const table = kind === "project" ? labProjects : labUpdates;
  const [row] = await db.delete(table).where(eq(table.id, z.uuid().parse(id))).returning({ id: table.id });
  if (!row) throw new UserError("Already deleted.");
  await recordAudit(db, { actorId: ctx.userId, action: `lab_${kind}.delete`, entityType: `lab_${kind}`, entityId: id });
}
