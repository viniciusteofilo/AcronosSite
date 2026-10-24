import { base32 } from "@better-auth/utils/base32";
import { createOTP } from "@better-auth/utils/otp";
import { expect, test } from "@playwright/test";
import postgres from "postgres";

const sqlClient = () => {
  const url = process.env.TEST_DATABASE_URL;
  if (!url || !new URL(url).pathname.includes("test")) throw new Error("TEST_DATABASE_URL must point at a test database");
  return postgres(url, { max: 1 });
};

test.beforeEach(async () => {
  const sql = sqlClient();
  await sql`DELETE FROM rate_limits`;
  await sql.end();
});

test("home renders the campaign layout with no horizontal scroll", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: "ACRONOS home" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
});

test("public pages load without horizontal scroll", async ({ page }) => {
  for (const path of ["/shop", "/collections", "/about", "/lab", "/sci-fi", "/contact", "/cart", "/policies/privacy"]) {
    const res = await page.goto(path);
    expect(res?.status(), path).toBe(200);
    await expect(page.getByRole("heading", { level: 1 }), path).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), path).toBeLessThanOrEqual(0);
  }
});

test("search opens from the header and goes to the shop", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Search" }).click();
  const box = page.getByRole("searchbox", { name: "Search products" });
  await expect(box).toBeFocused();
  await box.fill("jacket");
  await box.press("Enter");
  await expect(page).toHaveURL(/\/shop\?q=jacket/);
  await expect(page.getByRole("status").filter({ hasText: "for “jacket”" })).toBeVisible();
});

test("mobile menu opens as a modal and closes with Escape", async ({ page, isMobile }) => {
  test.skip(!isMobile, "mobile only");
  await page.goto("/");
  await page.getByRole("button", { name: "Open menu" }).click();
  const menu = page.getByRole("dialog", { name: "Menu" });
  await expect(menu).toBeVisible();
  await expect(page.getByRole("button", { name: "Close menu" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
});

test("unknown product shows not found", async ({ page }) => {
  await page.goto("/products/does-not-exist");
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
});

test("contact form validates on the server and confirms", async ({ page }) => {
  await page.goto("/contact");
  await page.getByLabel("Email").fill("person@example.test");
  await page.getByLabel("Message").fill("Hello, this is a test message.");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByText("Enter your name.")).toBeVisible();
  // what the person typed survives the validation error
  await expect(page.getByLabel("Message")).toHaveValue("Hello, this is a test message.");
  await expect(page.getByLabel("Email")).toHaveValue("person@example.test");
  await page.getByLabel("Name").fill("Test Person");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByRole("status").filter({ hasText: "We received your message" })).toBeVisible();
});

test("newsletter requires explicit consent", async ({ page }) => {
  await page.goto("/about");
  const footer = page.getByRole("contentinfo");
  await footer.getByPlaceholder("Email address").fill(`news-${Date.now()}@example.test`);
  await footer.getByRole("button", { name: "Subscribe" }).click();
  await expect(footer.getByRole("alert")).toHaveText(/confirm you want to receive/);
  await footer.getByRole("checkbox").check();
  await footer.getByRole("button", { name: "Subscribe" }).click();
  await expect(footer.getByRole("status")).toHaveText(/confirm before sending/);
});

test("site editor: a content editor changes the homepage and publishes it", async ({ page, baseURL, isMobile }) => {
  test.skip(!!isMobile, "editing is tested on desktop");
  const email = `editor-${Date.now()}@example.test`;
  const password = "editor password 2026";
  const headers = { origin: baseURL! };
  expect((await page.request.post("/api/auth/sign-up/email", { data: { email, password, name: "Editor" }, headers })).ok()).toBeTruthy();
  const enable = await page.request.post("/api/auth/two-factor/enable", { data: { password, method: "totp" }, headers });
  const { totpURI } = (await enable.json()) as { totpURI: string };
  const otp = createOTP(new TextDecoder().decode(base32.decode(new URL(totpURI).searchParams.get("secret")!)));
  expect((await page.request.post("/api/auth/two-factor/verify-totp", { data: { code: await otp.totp() }, headers })).ok()).toBeTruthy();
  const sql = sqlClient();
  await sql`INSERT INTO user_roles (user_id, role) SELECT id, 'content_editor' FROM users WHERE email = ${email}`;
  await sql.end();

  await page.goto("/admin/site");
  await expect(page.getByRole("heading", { name: "Site editor · Homepage" })).toBeVisible();
  const headline = `Campaign ${Date.now()}`;
  await page.getByLabel(/^Headline/).fill(headline);
  await expect(page.getByRole("status").filter({ hasText: "Unsaved changes" })).toBeVisible();
  await page.getByRole("button", { name: "Publish now" }).click();
  await expect(page.getByText("Published. The homepage is updated.")).toBeVisible();

  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(headline.split(" ")[1]);
});
