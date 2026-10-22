import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "@/db/client";
import { scrollSequences } from "@/db/schema";
import { UserError, authorize } from "@/server/admin/errors";
import { recordAudit } from "@/server/audit/log";
import type { AccessContext } from "@/server/rbac/access";
import { getMediaStorage } from "./storage";
import { readWebpSize } from "./webp";

/** Limits that keep the film light: about 10 seconds at 12 frames per second. */
export const SEQUENCE_LIMITS = {
  maxFrames: 150,
  desktopMaxWidth: 1920,
  mobileMaxWidth: 960,
  maxFrameBytes: 700 * 1024,
  maxBatch: 16,
} as const;

const createInput = z.object({
  frameCount: z.number().int().min(12, "The video is too short (at least 1 second).").max(SEQUENCE_LIMITS.maxFrames, "The video is too long."),
  width: z.number().int().min(320).max(SEQUENCE_LIMITS.desktopMaxWidth),
  height: z.number().int().min(180).max(SEQUENCE_LIMITS.desktopMaxWidth),
  mobileWidth: z.number().int().min(240).max(SEQUENCE_LIMITS.mobileMaxWidth),
  mobileHeight: z.number().int().min(135).max(SEQUENCE_LIMITS.desktopMaxWidth),
  originalName: z.string().max(200).optional(),
});

export const frameKey = (id: string, size: "d" | "m", index: number) => `seq/${id}/${size}/${String(index).padStart(4, "0")}.webp`;

export type SequenceView = {
  id: string;
  frameCount: number;
  width: number;
  height: number;
  mobileWidth: number;
  mobileHeight: number;
  /** URL of frame NNNN: replace {size} with d or m and {n} with the 4-digit index. */
  pattern: string;
};

const toView = (r: typeof scrollSequences.$inferSelect): SequenceView => ({
  id: r.id,
  frameCount: r.frameCount,
  width: r.width,
  height: r.height,
  mobileWidth: r.mobileWidth,
  mobileHeight: r.mobileHeight,
  pattern: `/seq/${r.id}/{size}/{n}.webp`,
});

/** Starts a new film. Frames are uploaded in batches, then the film is finalized. */
export async function createSequence(db: Database, actor: AccessContext | null, raw: unknown) {
  const ctx = authorize(actor, "content:write");
  const input = createInput.parse(raw);
  const [row] = await db.insert(scrollSequences).values({ ...input, createdBy: ctx.userId }).returning();
  return { id: row.id };
}

/**
 * Stores a batch of frames. Each file must be a real WebP of the size declared for the film,
 * named d-NNNN or m-NNNN with an index inside the film.
 */
export async function uploadSequenceFrames(db: Database, actor: AccessContext | null, id: string, files: { name: string; bytes: Uint8Array }[]) {
  authorize(actor, "content:write");
  const [seq] = await db.select().from(scrollSequences).where(eq(scrollSequences.id, z.uuid().parse(id))).limit(1);
  if (!seq) throw new UserError("Film not found.");
  if (seq.status !== "uploading") throw new UserError("This film is already complete.");
  if (files.length < 1 || files.length > SEQUENCE_LIMITS.maxBatch) throw new UserError("Send between 1 and 16 frames at a time.");
  const storage = getMediaStorage();
  let bytes = 0;
  for (const f of files) {
    const m = /^([dm])-(\d{4})$/.exec(f.name);
    if (!m) throw new UserError("Unexpected frame name.");
    const size = m[1] as "d" | "m";
    const index = Number(m[2]);
    if (index >= seq.frameCount) throw new UserError("Frame number out of range.");
    if (f.bytes.byteLength > SEQUENCE_LIMITS.maxFrameBytes) throw new UserError("A frame is too large.");
    const dims = readWebpSize(f.bytes);
    const expected = size === "d" ? [seq.width, seq.height] : [seq.mobileWidth, seq.mobileHeight];
    if (!dims || dims.width !== expected[0] || dims.height !== expected[1]) throw new UserError("A frame does not match the film size.");
    await storage.put(frameKey(seq.id, size, index), f.bytes, "image/webp");
    bytes += f.bytes.byteLength;
  }
  await db.update(scrollSequences).set({ totalBytes: sql`${scrollSequences.totalBytes} + ${bytes}` }).where(eq(scrollSequences.id, seq.id));
}

/** Checks that every frame exists in both sizes, then makes the film usable. */
export async function finalizeSequence(db: Database, actor: AccessContext | null, id: string): Promise<SequenceView> {
  const ctx = authorize(actor, "content:write");
  const [seq] = await db.select().from(scrollSequences).where(eq(scrollSequences.id, z.uuid().parse(id))).limit(1);
  if (!seq) throw new UserError("Film not found.");
  const storage = getMediaStorage();
  for (let i = 0; i < seq.frameCount; i++) {
    for (const size of ["d", "m"] as const) {
      if (!(await storage.get(frameKey(seq.id, size, i)))) throw new UserError(`Frame ${i + 1} is missing. Upload the video again.`);
    }
  }
  const [row] = await db.update(scrollSequences).set({ status: "ready" }).where(and(eq(scrollSequences.id, seq.id))).returning();
  await recordAudit(db, { actorId: ctx.userId, action: "media.sequence_create", entityType: "scroll_sequence", entityId: seq.id, after: { frames: seq.frameCount, bytes: row.totalBytes } });
  return toView(row);
}

export async function getSequence(db: Database, id: string | null | undefined): Promise<SequenceView | null> {
  if (!id || !z.uuid().safeParse(id).success) return null;
  const [row] = await db.select().from(scrollSequences).where(and(eq(scrollSequences.id, id), eq(scrollSequences.status, "ready"))).limit(1);
  return row ? toView(row) : null;
}
