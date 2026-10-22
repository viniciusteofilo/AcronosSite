import { afterAll, describe, expect, it } from "vitest";
import {
  createSequence,
  finalizeSequence,
  getSequence,
  uploadSequenceFrames,
} from "@/server/media/sequences";
import { runAdmin } from "@/server/admin/errors";
import { AccessDeniedError } from "@/server/rbac/access";
import { ctxFor, makeUser, testDb } from "../helpers";

const { db, client } = testDb();
afterAll(() => client.end());

/** Minimal VP8X WebP header with the given size (enough for the size check). */
function webp(width: number, height: number): Uint8Array {
  const b = new Uint8Array(40);
  const put = (o: number, s: string) =>
    [...s].forEach((c, i) => (b[o + i] = c.charCodeAt(0)));
  put(0, "RIFF");
  put(8, "WEBP");
  put(12, "VP8X");
  const u24 = (o: number, v: number) => (
    (b[o] = v & 255),
    (b[o + 1] = (v >> 8) & 255),
    (b[o + 2] = (v >> 16) & 255)
  );
  u24(24, width - 1);
  u24(27, height - 1);
  return b;
}

const film = {
  frameCount: 12,
  width: 1600,
  height: 900,
  mobileWidth: 800,
  mobileHeight: 450,
  originalName: "campaign.mp4",
};
const n = (i: number) => String(i).padStart(4, "0");
const allFrames = (from: number, to: number) =>
  Array.from({ length: to - from }, (_, k) => from + k).flatMap((i) => [
    { name: `d-${n(i)}`, bytes: webp(1600, 900) },
    { name: `m-${n(i)}`, bytes: webp(800, 450) },
  ]);

describe("scroll films", () => {
  it("only content staff can create films", async () => {
    const customer = ctxFor(await makeUser(db), []);
    await expect(createSequence(db, customer, film)).rejects.toBeInstanceOf(
      AccessDeniedError,
    );
    await expect(createSequence(db, null, film)).rejects.toBeInstanceOf(
      AccessDeniedError,
    );
  });

  it("validates the declared film", async () => {
    const editor = ctxFor(
      await makeUser(db, { roles: ["content_editor"], twoFactorEnabled: true }),
      ["content_editor"],
    );
    expect(
      (
        await runAdmin(
          () => createSequence(db, editor, { ...film, frameCount: 500 }),
          "ok",
        )
      ).ok,
    ).toBe(false);
    expect(
      (
        await runAdmin(
          () => createSequence(db, editor, { ...film, width: 8000 }),
          "ok",
        )
      ).ok,
    ).toBe(false);
  });

  it("checks every frame and only publishes a complete film", async () => {
    const editor = ctxFor(
      await makeUser(db, { roles: ["content_editor"], twoFactorEnabled: true }),
      ["content_editor"],
    );
    const { id } = await createSequence(db, editor, film);
    const bad = (files: { name: string; bytes: Uint8Array }[]) =>
      runAdmin(() => uploadSequenceFrames(db, editor, id, files), "ok");
    expect(
      (await bad([{ name: "d-0000", bytes: webp(1280, 720) }])).message,
    ).toMatch(/size/);
    expect(
      (await bad([{ name: "d-0012", bytes: webp(1600, 900) }])).message,
    ).toMatch(/range/);
    expect(
      (await bad([{ name: "../x", bytes: webp(1600, 900) }])).message,
    ).toMatch(/name/);
    expect(
      (
        await bad([
          {
            name: "d-0000",
            bytes: new TextEncoder().encode("<svg onload=alert(1)>".padEnd(40)),
          },
        ])
      ).message,
    ).toMatch(/size/);
    expect((await bad(allFrames(0, 9))).message).toMatch(/between 1 and 16/);

    await uploadSequenceFrames(db, editor, id, allFrames(0, 8));
    expect(
      (await runAdmin(() => finalizeSequence(db, editor, id), "ok")).message,
    ).toMatch(/Frame 9 is missing/);
    expect(await getSequence(db, id)).toBeNull(); // not usable while incomplete

    await uploadSequenceFrames(db, editor, id, allFrames(8, 12));
    const view = await finalizeSequence(db, editor, id);
    expect(view).toMatchObject({
      id,
      frameCount: 12,
      width: 1600,
      mobileWidth: 800,
      pattern: `/seq/${id}/{size}/{n}.webp`,
    });
    expect(await getSequence(db, id)).toEqual(view);
    expect((await bad(allFrames(0, 1))).message).toMatch(/already complete/);
    expect(await getSequence(db, "not-a-uuid")).toBeNull();
  });
});
