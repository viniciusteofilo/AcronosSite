import { desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "@/db/client";
import { mediaAssets, type MediaRendition } from "@/db/schema";
import { recordAudit } from "@/server/audit/log";
import { AccessDeniedError, decideStaffAccess, type AccessContext } from "@/server/rbac/access";
import { getMediaStorage, mediaUrl } from "./storage";
import { readWebpSize } from "./webp";

export const MAX_RENDITION_BYTES = 6 * 1024 * 1024;
export const MAX_RENDITION_WIDTH = 2400;
export const RENDITION_WIDTHS = [640, 1280, 2400] as const;

export type MediaView = {
  id: string;
  alt: string;
  width: number;
  height: number;
  focalX: number;
  focalY: number;
  src: string;
  srcSet: string;
};

export function toMediaView(row: typeof mediaAssets.$inferSelect): MediaView {
  const renditions = [...(row.renditions ?? [])].sort((a, b) => a.width - b.width);
  const largest = renditions.at(-1);
  return {
    id: row.id,
    alt: row.altText ?? "",
    width: row.width ?? largest?.width ?? 0,
    height: row.height ?? largest?.height ?? 0,
    focalX: Number(row.focalX),
    focalY: Number(row.focalY),
    src: mediaUrl(largest?.key ?? row.storageKey),
    srcSet: renditions.map((r) => `${mediaUrl(r.key)} ${r.width}w`).join(", "),
  };
}

export async function getMediaByIds(db: Database, ids: string[]): Promise<Map<string, MediaView>> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return new Map();
  const rows = await db.select().from(mediaAssets).where(inArray(mediaAssets.id, unique));
  return new Map(rows.map((r) => [r.id, toMediaView(r)]));
}

export async function listMedia(db: Database, actor: AccessContext | null, limit = 120) {
  const decision = decideStaffAccess(actor, "content:write");
  if (!decision.ok) throw new AccessDeniedError(decision.reason);
  const rows = await db.select().from(mediaAssets).orderBy(desc(mediaAssets.createdAt)).limit(limit);
  return rows.map((r) => ({ ...toMediaView(r), originalName: r.originalName, createdAt: r.createdAt }));
}

const uploadMeta = z.object({
  originalName: z.string().max(200).optional(),
  alt: z.string().max(300).default(""),
});

/**
 * Stores one image already resized in the browser into WebP renditions.
 * Every file is checked by content (WebP signature and real dimensions) and size.
 */
export async function createMediaAsset(
  db: Database,
  actor: AccessContext | null,
  input: { files: Uint8Array[]; meta: unknown },
): Promise<MediaView> {
  const decision = decideStaffAccess(actor, "content:write");
  if (!decision.ok) throw new AccessDeniedError(decision.reason);
  const meta = uploadMeta.parse(input.meta);
  if (input.files.length < 1 || input.files.length > RENDITION_WIDTHS.length) {
    throw new UploadError("Send between 1 and 3 image sizes.");
  }

  const checked = input.files.map((bytes) => {
    if (bytes.byteLength > MAX_RENDITION_BYTES) throw new UploadError("Image file is too large.");
    const size = readWebpSize(bytes);
    if (!size) throw new UploadError("Only WebP images produced by the editor are accepted.");
    if (size.width < 64 || size.height < 64) throw new UploadError("Image is too small.");
    if (size.width > MAX_RENDITION_WIDTH || size.height > MAX_RENDITION_WIDTH * 2) {
      throw new UploadError("Image is larger than the allowed size.");
    }
    return { bytes, ...size };
  });

  const id = crypto.randomUUID();
  const now = new Date();
  const prefix = `media/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${id}`;
  const storage = getMediaStorage();
  const renditions: MediaRendition[] = [];
  for (const file of checked.sort((a, b) => a.width - b.width)) {
    const key = `${prefix}-${file.width}.webp`;
    if (renditions.some((r) => r.key === key)) continue;
    await storage.put(key, file.bytes, "image/webp");
    renditions.push({ key, width: file.width, height: file.height, bytes: file.bytes.byteLength });
  }
  const largest = renditions.at(-1)!;

  const [row] = await db.transaction(async (tx) => {
    const inserted = await tx
      .insert(mediaAssets)
      .values({
        id,
        storageKey: largest.key,
        contentType: "image/webp",
        byteSize: renditions.reduce((n, r) => n + r.bytes, 0),
        width: largest.width,
        height: largest.height,
        renditions,
        originalName: meta.originalName,
        altText: meta.alt,
        uploadedBy: decision.ctx.userId,
      })
      .returning();
    await recordAudit(tx, {
      actorId: decision.ctx.userId,
      action: "media.upload",
      entityType: "media",
      entityId: id,
      after: { originalName: meta.originalName, renditions: renditions.length },
    });
    return inserted;
  });
  return toMediaView(row);
}

const mediaUpdate = z.object({
  id: z.uuid(),
  alt: z.string().max(300).optional(),
  focalX: z.number().min(0).max(1).optional(),
  focalY: z.number().min(0).max(1).optional(),
});

export async function updateMediaAsset(db: Database, actor: AccessContext | null, input: unknown) {
  const decision = decideStaffAccess(actor, "content:write");
  if (!decision.ok) throw new AccessDeniedError(decision.reason);
  const { id, alt, focalX, focalY } = mediaUpdate.parse(input);
  await db
    .update(mediaAssets)
    .set({
      ...(alt !== undefined && { altText: alt }),
      ...(focalX !== undefined && { focalX: focalX.toFixed(3) }),
      ...(focalY !== undefined && { focalY: focalY.toFixed(3) }),
    })
    .where(eq(mediaAssets.id, id));
}

export class UploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UploadError";
  }
}
