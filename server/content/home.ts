import { and, desc, eq, isNotNull, lte, sql } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "@/db/client";
import { contentRevisions, pages } from "@/db/schema";
import { recordAudit } from "@/server/audit/log";
import { getMediaByIds, type MediaView } from "@/server/media/library";
import { AccessDeniedError, decideStaffAccess, type AccessContext } from "@/server/rbac/access";

export const HOME_SLUG = "home";

/** Links: a path on this site ("/shop") or an https address. Nothing else (no javascript:, no data:). */
const href = z
  .string()
  .trim()
  .max(300)
  .refine((v) => (v.startsWith("/") && !v.startsWith("//")) || /^https:\/\/[^\s]+$/.test(v), "Use a page path like /shop or an https:// link");

const cta = z.object({ label: z.string().trim().max(40), href });
const text = (max: number) => z.string().trim().max(max);
const imageId = z.uuid().nullable();

/** Everything on the homepage that changes with a campaign. Defaults are the approved layout copy. */
export const homeBlocksSchema = z.object({
  hero: z
    .object({
      imageId,
      eyebrow: text(60),
      headline: text(80),
      tags: text(120),
      primary: cta,
      secondary: cta,
      footnote: text(80),
    }),
  featuredCollection: z
    .object({ imageId, eyebrow: text(60), title: text(60), text: text(400), cta }),
  featuredProducts: z
    .object({ eyebrow: text(60), title: text(60), mode: z.enum(["newest", "manual"]), productIds: z.array(z.uuid()).max(8) }),
  manifesto: z.object({ eyebrow: text(60), title: text(80), text: text(600) }),
  lab: z.object({ imageId, eyebrow: text(60), title: text(40), line: text(60), text: text(300), cta }),
  scifi: z.object({ imageId, eyebrow: text(60), title: text(40), line: text(60), text: text(300), cta }),
});

export type HomeBlocks = z.infer<typeof homeBlocksSchema>;

export const HOME_DEFAULTS: HomeBlocks = {
  hero: {
    imageId: null,
    eyebrow: "ACN // São Paulo · 2018",
    headline: "Future observed from everyday chaos.",
    tags: "Techwear · Streetwear · Design · Innovation · Purpose",
    primary: { label: "Explore collections", href: "/collections" },
    secondary: { label: "Shop now", href: "/shop" },
    footnote: "Global uniform for a changing world",
  },
  featuredCollection: {
    imageId: null,
    eyebrow: "01 // Featured collection",
    title: "Collection name",
    text: "Short collection statement written by ACRONOS.",
    cta: { label: "Discover collection", href: "/collections" },
  },
  featuredProducts: { eyebrow: "02 // Selected", title: "Featured products", mode: "newest", productIds: [] },
  manifesto: {
    eyebrow: "03 // Manifesto",
    title: "More than clothing. A movement.",
    text: "Founded in São Paulo in 2018, ACRONOS designs for the space between order and chaos, where technology, industrial design and street culture meet the everyday.",
  },
  lab: {
    imageId: null,
    eyebrow: "04 // Social project · in planning",
    title: "Acronos Lab",
    line: "Building futures.",
    text: "A project to open paths for young people in technology, design and innovation.",
    cta: { label: "Discover Acronos Lab", href: "/lab" },
  },
  scifi: {
    imageId: null,
    eyebrow: "05 // Original fiction",
    title: "Acronos Sci-Fi",
    line: "Stories of other tomorrows.",
    text: "Original short stories about technology, humanity and the future.",
    cta: { label: "Explore stories", href: "/sci-fi" },
  },
};

/** Merges stored content over the defaults section by section, so old saves keep working. */
export function normalizeHome(value: unknown): HomeBlocks {
  const stored = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const merged: Record<string, unknown> = {};
  for (const key of Object.keys(HOME_DEFAULTS) as (keyof HomeBlocks)[]) {
    const section = stored[key];
    merged[key] = { ...HOME_DEFAULTS[key], ...(section && typeof section === "object" ? section : {}) };
  }
  const parsed = homeBlocksSchema.safeParse(merged);
  return parsed.success ? parsed.data : HOME_DEFAULTS;
}

export function imageIdsOf(blocks: HomeBlocks): string[] {
  return [blocks.hero.imageId, blocks.featuredCollection.imageId, blocks.lab.imageId, blocks.scifi.imageId].filter(
    (v): v is string => Boolean(v),
  );
}

export type ResolvedHome = { blocks: HomeBlocks; media: Map<string, MediaView> };

async function ensureHomeRow(db: Database) {
  await db
    .insert(pages)
    .values({ slug: HOME_SLUG, title: "Homepage", blocks: HOME_DEFAULTS, status: "published" })
    .onConflictDoNothing();
}

/**
 * Promotes a scheduled campaign whose time has come. Atomic: if two visitors arrive at the
 * same moment, only one UPDATE matches, and the revision is recorded once.
 */
async function promoteDueSchedule(db: Database, now: Date) {
  await db.transaction(async (tx) => {
    const promoted = await tx
      .update(pages)
      .set({ blocks: sql`${pages.scheduledBlocks}`, scheduledBlocks: null, scheduledAt: null, updatedAt: now })
      .where(and(eq(pages.slug, HOME_SLUG), isNotNull(pages.scheduledBlocks), lte(pages.scheduledAt, now)))
      .returning({ id: pages.id, blocks: pages.blocks });
    if (promoted[0]) {
      await tx.insert(contentRevisions).values({ entityType: "page", entityId: promoted[0].id, snapshot: promoted[0].blocks });
      await recordAudit(tx, { actorId: null, action: "page.schedule_published", entityType: "page", entityId: promoted[0].id });
    }
  });
}

/** What visitors see. */
export async function getLiveHome(db: Database, now: Date = new Date()): Promise<ResolvedHome> {
  await promoteDueSchedule(db, now);
  const [row] = await db.select({ blocks: pages.blocks }).from(pages).where(eq(pages.slug, HOME_SLUG)).limit(1);
  const blocks = normalizeHome(row?.blocks);
  return { blocks, media: await getMediaByIds(db, imageIdsOf(blocks)) };
}

function requireEditor(actor: AccessContext | null) {
  const decision = decideStaffAccess(actor, "content:write");
  if (!decision.ok) throw new AccessDeniedError(decision.reason);
  return decision.ctx;
}

export type HomeEditorState = {
  draft: HomeBlocks;
  hasDraft: boolean;
  live: HomeBlocks;
  scheduledAt: Date | null;
  media: Map<string, MediaView>;
  revisions: { id: string; createdAt: Date }[];
};

/** Editor view: the working copy (draft if any, otherwise what is live), plus schedule and history. */
export async function getHomeEditorState(db: Database, actor: AccessContext | null): Promise<HomeEditorState> {
  requireEditor(actor);
  await ensureHomeRow(db);
  await promoteDueSchedule(db, new Date());
  const [row] = await db.select().from(pages).where(eq(pages.slug, HOME_SLUG)).limit(1);
  const live = normalizeHome(row.blocks);
  const draft = row.draftBlocks ? normalizeHome(row.draftBlocks) : live;
  const revisions = await db
    .select({ id: contentRevisions.id, createdAt: contentRevisions.createdAt })
    .from(contentRevisions)
    .where(and(eq(contentRevisions.entityType, "page"), eq(contentRevisions.entityId, row.id)))
    .orderBy(desc(contentRevisions.createdAt))
    .limit(10);
  return {
    draft,
    hasDraft: row.draftBlocks !== null,
    live,
    scheduledAt: row.scheduledAt,
    media: await getMediaByIds(db, [...imageIdsOf(draft), ...imageIdsOf(live)]),
    revisions,
  };
}

export async function saveHomeDraft(db: Database, actor: AccessContext | null, input: unknown) {
  const ctx = requireEditor(actor);
  const blocks = homeBlocksSchema.parse(input);
  await ensureHomeRow(db);
  await db
    .update(pages)
    .set({ draftBlocks: blocks, updatedBy: ctx.userId, updatedAt: new Date() })
    .where(eq(pages.slug, HOME_SLUG));
  return blocks;
}

/** Puts the saved draft live now. The previous live version goes to the history. */
export async function publishHome(db: Database, actor: AccessContext | null) {
  const ctx = requireEditor(actor);
  await db.transaction(async (tx) => {
    const [row] = await tx.select().from(pages).where(eq(pages.slug, HOME_SLUG)).for("update");
    if (!row?.draftBlocks) throw new Error("There are no unpublished changes.");
    await tx.insert(contentRevisions).values({ entityType: "page", entityId: row.id, snapshot: row.blocks, authorId: ctx.userId });
    await tx
      .update(pages)
      .set({ blocks: row.draftBlocks, draftBlocks: null, status: "published", updatedBy: ctx.userId, updatedAt: new Date() })
      .where(eq(pages.id, row.id));
    await recordAudit(tx, { actorId: ctx.userId, action: "page.publish", entityType: "page", entityId: row.id });
  });
}

/** Queues the saved draft to go live at a future time. */
export async function scheduleHome(db: Database, actor: AccessContext | null, at: unknown, now: Date = new Date()) {
  const ctx = requireEditor(actor);
  const when = z.coerce.date().parse(at);
  if (when.getTime() <= now.getTime() + 60_000) throw new Error("Pick a time at least one minute from now.");
  await db.transaction(async (tx) => {
    const [row] = await tx.select().from(pages).where(eq(pages.slug, HOME_SLUG)).for("update");
    if (!row?.draftBlocks) throw new Error("Save your changes before scheduling.");
    await tx
      .update(pages)
      .set({ scheduledBlocks: row.draftBlocks, scheduledAt: when, draftBlocks: null, updatedBy: ctx.userId, updatedAt: now })
      .where(eq(pages.id, row.id));
    await recordAudit(tx, { actorId: ctx.userId, action: "page.schedule", entityType: "page", entityId: row.id, after: { at: when.toISOString() } });
  });
}

export async function cancelHomeSchedule(db: Database, actor: AccessContext | null) {
  const ctx = requireEditor(actor);
  await db.transaction(async (tx) => {
    const [row] = await tx.select().from(pages).where(eq(pages.slug, HOME_SLUG)).for("update");
    if (!row?.scheduledBlocks) return;
    // The scheduled campaign comes back as the working draft, so nothing is lost.
    await tx
      .update(pages)
      .set({ draftBlocks: row.scheduledBlocks, scheduledBlocks: null, scheduledAt: null, updatedBy: ctx.userId })
      .where(eq(pages.id, row.id));
    await recordAudit(tx, { actorId: ctx.userId, action: "page.schedule_cancel", entityType: "page", entityId: row.id });
  });
}

/** Loads an earlier version into the draft. Nothing changes for visitors until it is published. */
export async function restoreHomeRevision(db: Database, actor: AccessContext | null, revisionId: unknown) {
  const ctx = requireEditor(actor);
  const id = z.uuid().parse(revisionId);
  const [rev] = await db.select().from(contentRevisions).where(eq(contentRevisions.id, id)).limit(1);
  if (!rev) throw new Error("Version not found.");
  await db
    .update(pages)
    .set({ draftBlocks: normalizeHome(rev.snapshot), updatedBy: ctx.userId })
    .where(and(eq(pages.slug, HOME_SLUG), eq(pages.id, rev.entityId)));
}

export async function discardHomeDraft(db: Database, actor: AccessContext | null) {
  const ctx = requireEditor(actor);
  await db.update(pages).set({ draftBlocks: null, updatedBy: ctx.userId }).where(eq(pages.slug, HOME_SLUG));
}
