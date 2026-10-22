import AxeBuilder from "@axe-core/playwright";
import { base32 } from "@better-auth/utils/base32";
import { createOTP } from "@better-auth/utils/otp";
import { expect, test } from "@playwright/test";
import postgres from "postgres";

const sqlClient = () => {
  const url = process.env.TEST_DATABASE_URL;
  if (!url || !new URL(url).pathname.includes("test"))
    throw new Error("TEST_DATABASE_URL must point at a test database");
  return postgres(url, { max: 1 });
};

test("campaign film: upload in the site editor, plays with scroll, still frame for reduced motion", async ({
  page,
  baseURL,
  isMobile,
}) => {
  test.skip(
    isMobile,
    "the editor flow runs once on desktop; the storefront is checked at phone width below",
  );
  test.setTimeout(180_000);
  const sql = sqlClient();
  await sql`DELETE FROM rate_limits`;
  const email = `film-${Date.now()}@example.com`;
  const password = "editor password 2026";
  const headers = { origin: baseURL! };
  expect(
    (
      await page.request.post("/api/auth/sign-up/email", {
        data: { email, password, name: "Editor" },
        headers,
      })
    ).ok(),
  ).toBeTruthy();
  const enable = await page.request.post("/api/auth/two-factor/enable", {
    data: { password, method: "totp" },
    headers,
  });
  const { totpURI } = (await enable.json()) as { totpURI: string };
  const otp = createOTP(
    new TextDecoder().decode(
      base32.decode(new URL(totpURI).searchParams.get("secret")!),
    ),
  );
  expect(
    (
      await page.request.post("/api/auth/two-factor/verify-totp", {
        data: { code: await otp.totp() },
        headers,
      })
    ).ok(),
  ).toBeTruthy();
  await sql`INSERT INTO user_roles (user_id, role) SELECT id, 'content_editor' FROM users WHERE email = ${email}`;
  await sql.end();

  await page.goto("/admin/site");
  await expect(
    page.getByRole("heading", { name: "Site editor · Homepage" }),
  ).toBeVisible();
  // the open-source Chromium used in tests has no H.264, so the fixture is WebM; Chrome/Edge read MP4
  await page
    .getByLabel("Choose campaign video")
    .setInputFiles("tests/fixtures/film.webm");
  await expect(page.getByText(/frames · 960×540 on computers/)).toBeVisible({
    timeout: 120_000,
  });
  await page.getByLabel(/^Caption under the film/).fill("Gate test");
  await page.getByRole("button", { name: "Publish now" }).click();
  await expect(
    page.getByText("Published. The homepage is updated."),
  ).toBeVisible();

  // desktop: the canvas changes as the visitor scrolls
  await page.goto("/");
  const film = page.getByRole("region", { name: /film/i });
  await expect(film).toBeVisible();
  await expect(film.getByText("Gate test")).toBeVisible();
  const canvas = film.locator("canvas");
  await expect(film.getByText("Film loaded")).toBeAttached({ timeout: 30_000 });
  const pixels = () =>
    canvas.evaluate((c: HTMLCanvasElement) => c.toDataURL("image/png").length);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(200);
  const before = await pixels();
  await page.evaluate(() => window.scrollTo(0, window.innerHeight));
  await expect.poll(pixels).not.toBe(before);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    ),
  ).toBeLessThanOrEqual(0);
  const axe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(axe.violations.map((v) => v.id)).toEqual([]);

  // phone width: smaller frames
  await page.setViewportSize({ width: 390, height: 844 });
  const mobileFrames: string[] = [];
  page.on(
    "request",
    (r) => r.url().includes("/m/") && mobileFrames.push(r.url()),
  );
  await page.goto("/");
  await expect.poll(() => mobileFrames.length).toBeGreaterThan(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    ),
  ).toBeLessThanOrEqual(0);

  // reduced motion: only the first frame, no canvas, page not stretched
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(film.locator("img")).toBeVisible();
  await expect(canvas).toHaveCount(0);

  // the skip link goes to the headline
  await film.getByRole("link", { name: /Skip/ }).click();
  await expect(page).toHaveURL(/#hero-title/);

  // removing the film brings back the photo opening (and leaves the homepage as other tests expect)
  await page.emulateMedia({ reducedMotion: null });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/admin/site");
  await page.getByRole("button", { name: "Remove film" }).click();
  await page.getByRole("button", { name: "Publish now" }).click();
  await expect(
    page.getByText("Published. The homepage is updated."),
  ).toBeVisible();
  await page.goto("/");
  await expect(page.getByRole("region", { name: /film/i })).toHaveCount(0);
});
