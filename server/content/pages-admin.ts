import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "@/db/client";
import { contentRevisions, pages, users } from "@/db/schema";
import { UserError, authorize } from "@/server/admin/errors";
import { recordAudit } from "@/server/audit/log";
import type { AccessContext } from "@/server/rbac/access";
import { POLICY_SLUGS, simplePageSchema } from "./pages";

/** The institutional pages ACRONOS edits. Each has a fixed address on the site. */
export const EDITABLE_PAGES = {
  about: { title: "About", path: "/about", kind: "page" },
  lab: { title: "Acronos Lab (intro text)", path: "/lab", kind: "page" },
  ...Object.fromEntries(
    Object.entries(POLICY_SLUGS).map(([slug, title]) => [`policy-${slug}`, { title, path: `/policies/${slug}`, kind: "policy" }]),
  ),
} as Record<string, { title: string; path: string; kind: "page" | "policy" }>;

const pageInput = z.object({
  slug: z.string().refine((s) => s in EDITABLE_PAGES, "Unknown page"),
  title: z.string().trim().min(2, "Title is required").max(120),
  intro: z.string().trim().max(1200).default(""),
  sections: z
    .array(z.object({ heading: z.string().trim().max(120).default(""), body: z.string().trim().max(8000, "A section can have up to 8000 characters") }))
    .max(30)
    .default([]),
  status: z.enum(["draft", "published"]),
  seoTitle: z.string().trim().max(70).default(""),
  seoDescription: z.string().trim().max(170).default(""),
  /** Required to publish a policy: confirms the text was reviewed (protocol: no invented legal text). */
  legalReviewed: z.boolean().default(false),
});

export async function listPagesAdmin(db: Database, actor: AccessContext | null) {
  authorize(actor, "content:write");
  const rows = await db
    .select({ slug: pages.slug, title: pages.title, status: pages.status, updatedAt: pages.updatedAt, editor: users.email })
    .from(pages)
    .leftJoin(users, eq(users.id, pages.updatedBy))
    .where(inArray(pages.slug, Object.keys(EDITABLE_PAGES)));
  return Object.entries(EDITABLE_PAGES).map(([slug, meta]) => {
    const row = rows.find((r) => r.slug === slug);
    return {
      slug,
      ...meta,
      status: (row?.status ?? "missing") as string,
      updatedAt: row?.updatedAt.toISOString() ?? null,
      editor: row?.editor ?? null,
    };
  });
}

export async function getPageForEditor(db: Database, actor: AccessContext | null, slug: string) {
  authorize(actor, "content:write");
  const meta = EDITABLE_PAGES[slug];
  if (!meta) return null;
  const [row] = await db.select().from(pages).where(eq(pages.slug, slug)).limit(1);
  const content = simplePageSchema.safeParse(row?.blocks ?? {});
  const revisions = row
    ? await db
        .select({ id: contentRevisions.id, createdAt: contentRevisions.createdAt, author: users.email })
        .from(contentRevisions)
        .leftJoin(users, eq(users.id, contentRevisions.authorId))
        .where(and(eq(contentRevisions.entityType, "page"), eq(contentRevisions.entityId, row.id)))
        .orderBy(desc(contentRevisions.createdAt))
        .limit(20)
    : [];
  return {
    slug,
    ...meta,
    title: row?.title ?? meta.title,
    intro: content.success ? content.data.intro : "",
    sections: content.success ? content.data.sections : [],
    status: (row?.status === "published" ? "published" : "draft") as "draft" | "published",
    seoTitle: row?.seoTitle ?? "",
    seoDescription: row?.seoDescription ?? "",
    updatedAt: row?.updatedAt.toISOString() ?? null,
    revisions: revisions.map((r) => ({ id: r.id, createdAt: r.createdAt.toISOString(), author: r.author })),
  };
}

/** Saves a page. The previous version goes to the history first, so every save can be undone. */
export async function savePage(db: Database, actor: AccessContext | null, raw: unknown) {
  const ctx = authorize(actor, "content:write");
  const input = pageInput.parse(raw);
  const meta = EDITABLE_PAGES[input.slug];
  if (meta.kind === "policy" && input.status === "published" && !input.legalReviewed) {
    throw new UserError("Before publishing a policy, confirm the text was reviewed by ACRONOS (and its lawyer).", "legalReviewed");
  }
  const sections = input.sections.filter((s) => s.heading || s.body);
  const blocks = { intro: input.intro, sections };
  await db.transaction(async (tx) => {
    const [row] = await tx.select().from(pages).where(eq(pages.slug, input.slug)).for("update");
    const values = {
      title: input.title,
      blocks,
      status: input.status,
      seoTitle: input.seoTitle || null,
      seoDescription: input.seoDescription || null,
      updatedBy: ctx.userId,
      updatedAt: new Date(),
    };
    let id: string;
    if (row) {
      await tx.insert(contentRevisions).values({
        entityType: "page",
        entityId: row.id,
        snapshot: { title: row.title, status: row.status, seoTitle: row.seoTitle, seoDescription: row.seoDescription, ...(row.blocks as object) },
        authorId: ctx.userId,
      });
      await tx.update(pages).set(values).where(eq(pages.id, row.id));
      id = row.id;
    } else {
      const [created] = await tx.insert(pages).values({ slug: input.slug, ...values }).returning({ id: pages.id });
      id = created.id;
    }
    await recordAudit(tx, {
      actorId: ctx.userId,
      action: input.status === "published" ? "page.publish" : "page.save_draft",
      entityType: "page",
      entityId: id,
      after: { slug: input.slug, status: input.status, legalReviewed: meta.kind === "policy" ? input.legalReviewed : undefined },
    });
  });
}

/** Returns an earlier version so the editor can load it; nothing changes until it is saved. */
export async function getPageRevision(db: Database, actor: AccessContext | null, slug: string, revisionId: string) {
  authorize(actor, "content:write");
  const [row] = await db
    .select({ snapshot: contentRevisions.snapshot })
    .from(contentRevisions)
    .innerJoin(pages, eq(pages.id, contentRevisions.entityId))
    .where(and(eq(contentRevisions.id, z.uuid().parse(revisionId)), eq(pages.slug, slug), eq(contentRevisions.entityType, "page")))
    .limit(1);
  if (!row) throw new UserError("Version not found.");
  const snap = row.snapshot as Record<string, unknown>;
  const content = simplePageSchema.parse(snap);
  return {
    title: typeof snap.title === "string" ? snap.title : EDITABLE_PAGES[slug]?.title ?? "",
    intro: content.intro,
    sections: content.sections,
    seoTitle: typeof snap.seoTitle === "string" ? snap.seoTitle : "",
    seoDescription: typeof snap.seoDescription === "string" ? snap.seoDescription : "",
  };
}
