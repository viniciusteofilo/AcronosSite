import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import postgres from "postgres";

/**
 * Automated WCAG 2.2 A/AA checks (axe-core) on the public pages and the main admin screens.
 * Automated tools catch part of the issues; keyboard and screen-reader checks are in docs/ACCESSIBILITY.md.
 */
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function scan(page: import("@playwright/test").Page) {
  const r = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  return r.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(" | ")}`);
}

test.beforeEach(async () => {
  const url = process.env.TEST_DATABASE_URL!;
  const sql = postgres(url, { max: 1 });
  await sql`DELETE FROM rate_limits`;
  await sql.end();
});

for (const path of ["/", "/shop", "/collections", "/sci-fi", "/lab", "/about", "/contact", "/cart", "/policies/privacy", "/login"]) {
  test(`no WCAG violations on ${path}`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    expect(await scan(page)).toEqual([]);
  });
}

test("no WCAG violations on the mobile menu and search", async ({ page, isMobile }) => {
  test.skip(!isMobile, "mobile only");
  await page.goto("/");
  await expect(async () => {
    await page.getByRole("button", { name: "Open menu" }).click();
    await expect(page.getByRole("dialog", { name: "Menu" })).toBeVisible({ timeout: 1000 });
  }).toPass();
  expect(await scan(page)).toEqual([]);
});

test("no WCAG violations on the main admin screens", async ({ page, baseURL, isMobile }) => {
  test.skip(!!isMobile, "admin is checked on desktop");
  test.setTimeout(120_000);
  const { base32 } = await import("@better-auth/utils/base32");
  const { createOTP } = await import("@better-auth/utils/otp");
  const email = `a11y-${Date.now()}@example.test`;
  const password = "a11y password 2026";
  const headers = { origin: baseURL! };
  await page.request.post("/api/auth/sign-up/email", { data: { email, password, name: "A11y" }, headers });
  const { totpURI } = (await (await page.request.post("/api/auth/two-factor/enable", { data: { password, method: "totp" }, headers })).json()) as { totpURI: string };
  const otp = createOTP(new TextDecoder().decode(base32.decode(new URL(totpURI).searchParams.get("secret")!)));
  await page.request.post("/api/auth/two-factor/verify-totp", { data: { code: await otp.totp() }, headers });
  const sql = postgres(process.env.TEST_DATABASE_URL!, { max: 1 });
  await sql`INSERT INTO user_roles (user_id, role) SELECT id, 'super_admin' FROM users WHERE email = ${email}`;
  await sql.end();
  const problems: string[] = [];
  for (const path of ["/admin", "/admin/products", "/admin/products/new", "/admin/inventory", "/admin/site", "/admin/sci-fi/new", "/admin/pages/about", "/admin/orders", "/admin/settings", "/admin/reports", "/admin/users"]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    for (const v of await scan(page)) problems.push(`${path}: ${v}`);
  }
  expect(problems).toEqual([]);
});
