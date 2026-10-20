import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import sanitizeHtml from "sanitize-html";
import type { Database } from "@/db/client";
import { labProjects, labUpdates, stories, storyCategories, storyCategoryLinks } from "@/db/schema";
import { getMediaByIds, type MediaView } from "@/server/media/library";

/**
 * Only formatting a story needs survives: paragraphs, headings, emphasis, quotes, lists,
 * line breaks and https links. Scripts, styles, event handlers and iframes are removed.
 */
export function sanitizeStoryHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ["p", "h2", "h3", "em", "strong", "blockquote", "ul", "ol", "li", "br", "hr", "a"],
    allowedAttributes: { a: ["href", "rel", "target"] },
    allowedSchemes: ["https", "mailto"],
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer nofollow", target: "_blank" }),
    },
  });
}

/** Published, or scheduled and due. */
const visibleStory = (now: Date) =>
  and(
    inArray(stories.status, ["published", "scheduled"]),
    sql`coalesce(${stories.publishAt}, ${stories.publishedAt}, ${stories.createdAt}) <= ${now.toISOString()}`,
  );
const storyDate = sql<Date>`coalesce(${stories.publishAt}, ${stories.publishedAt}, ${stories.createdAt})`;

export type StoryCard = {
  slug: string;
  title: string;
  synopsis: string | null;
  authorName: string;
  date: Date;
  readingMinutes: number | null;
  cover: MediaView | null;
};

export async function listStories(db: Database, opts: { limit?: number; now?: Date } = {}): Promise<StoryCard[]> {
  const now = opts.now ?? new Date();
  const rows = await db
    .select({
      slug: stories.slug,
      title: stories.title,
      synopsis: stories.synopsis,
      authorName: stories.authorName,
      date: storyDate,
      readingMinutes: stories.readingMinutes,
      coverImageId: stories.coverImageId,
    })
    .from(stories)
    .where(visibleStory(now))
    .orderBy(desc(storyDate))
    .limit(opts.limit ?? 60);
  const media = await getMediaByIds(db, rows.map((r) => r.coverImageId).filter((v): v is string => Boolean(v)));
  return rows.map(({ coverImageId, date, ...r }) => ({
    ...r,
    date: new Date(date),
    cover: coverImageId ? (media.get(coverImageId) ?? null) : null,
  }));
}

export async function getStoryBySlug(db: Database, slug: string, now: Date = new Date()) {
  const [s] = await db
    .select({ story: stories, date: storyDate })
    .from(stories)
    .where(and(eq(stories.slug, slug), visibleStory(now)))
    .limit(1);
  if (!s) return null;
  const date = new Date(s.date);
  const [cats, prev, next, media] = await Promise.all([
    db
      .select({ slug: storyCategories.slug, name: storyCategories.name })
      .from(storyCategoryLinks)
      .innerJoin(storyCategories, eq(storyCategories.id, storyCategoryLinks.categoryId))
      .where(eq(storyCategoryLinks.storyId, s.story.id)),
    db.select({ slug: stories.slug, title: stories.title }).from(stories).where(and(visibleStory(now), sql`${storyDate} < ${date.toISOString()}`)).orderBy(desc(storyDate)).limit(1),
    db.select({ slug: stories.slug, title: stories.title }).from(stories).where(and(visibleStory(now), sql`${storyDate} > ${date.toISOString()}`)).orderBy(asc(storyDate)).limit(1),
    s.story.coverImageId ? getMediaByIds(db, [s.story.coverImageId]) : Promise.resolve(new Map<string, MediaView>()),
  ]);
  const words = s.story.body.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
  return {
    slug: s.story.slug,
    title: s.story.title,
    synopsis: s.story.synopsis,
    authorName: s.story.authorName,
    date,
    readingMinutes: s.story.readingMinutes ?? Math.max(1, Math.round(words / 230)),
    bodyHtml: sanitizeStoryHtml(s.story.body),
    seoTitle: s.story.seoTitle,
    seoDescription: s.story.seoDescription,
    categories: cats,
    cover: s.story.coverImageId ? (media.get(s.story.coverImageId) ?? null) : null,
    previous: prev[0] ?? null,
    next: next[0] ?? null,
  };
}

export async function listLab(db: Database, now: Date = new Date()) {
  const [projects, updates] = await Promise.all([
    db
      .select({
        slug: labProjects.slug,
        title: labProjects.title,
        summary: labProjects.summary,
        initiativeStatus: labProjects.initiativeStatus,
      })
      .from(labProjects)
      .where(eq(labProjects.status, "published"))
      .orderBy(desc(labProjects.createdAt)),
    db
      .select({ slug: labUpdates.slug, title: labUpdates.title, date: sql<Date>`coalesce(${labUpdates.publishAt}, ${labUpdates.createdAt})` })
      .from(labUpdates)
      .where(
        and(
          inArray(labUpdates.status, ["published", "scheduled"]),
          sql`coalesce(${labUpdates.publishAt}, ${labUpdates.createdAt}) <= ${now.toISOString()}`,
        ),
      )
      .orderBy(desc(sql`coalesce(${labUpdates.publishAt}, ${labUpdates.createdAt})`))
      .limit(10),
  ]);
  return { projects, updates: updates.map((u) => ({ ...u, date: new Date(u.date) })) };
}
