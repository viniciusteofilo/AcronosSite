import { eq } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "@/db/client";
import { pages } from "@/db/schema";

/** Institutional pages (About, policies): an intro and titled sections, edited in the admin. */
export const simplePageSchema = z.object({
  intro: z.string().max(1200).default(""),
  sections: z
    .array(z.object({ heading: z.string().max(120), body: z.string().max(8000) }))
    .max(30)
    .default([]),
});
export type SimplePage = z.infer<typeof simplePageSchema> & { title: string };

export const POLICY_SLUGS = {
  shipping: "Shipping",
  returns: "Returns",
  privacy: "Privacy policy",
  terms: "Terms of service",
} as const;
export type PolicySlug = keyof typeof POLICY_SLUGS;

/** Published content for a page, or null when ACRONOS has not published it yet. */
export async function getSimplePage(db: Database, slug: string): Promise<SimplePage | null> {
  const [row] = await db
    .select({ title: pages.title, blocks: pages.blocks, status: pages.status })
    .from(pages)
    .where(eq(pages.slug, slug))
    .limit(1);
  if (!row || row.status !== "published") return null;
  const parsed = simplePageSchema.safeParse(row.blocks);
  if (!parsed.success || (!parsed.data.intro && parsed.data.sections.length === 0)) return null;
  return { title: row.title, ...parsed.data };
}
