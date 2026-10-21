import { base32 } from "@better-auth/utils/base32";
import { createOTP } from "@better-auth/utils/otp";
import { expect, test, type Page } from "@playwright/test";
import path from "node:path";
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

/** Signs up, turns on two-factor and gives the account a staff role. */
async function signInAsStaff(page: Page, baseURL: string, role: string) {
  const email = `${role}-${Date.now()}@example.test`;
  const password = "staff password 2026";
  const headers = { origin: baseURL };
  expect((await page.request.post("/api/auth/sign-up/email", { data: { email, password, name: "Staff" }, headers })).ok()).toBeTruthy();
  const enable = await page.request.post("/api/auth/two-factor/enable", { data: { password, method: "totp" }, headers });
  const { totpURI } = (await enable.json()) as { totpURI: string };
  const otp = createOTP(new TextDecoder().decode(base32.decode(new URL(totpURI).searchParams.get("secret")!)));
  expect((await page.request.post("/api/auth/two-factor/verify-totp", { data: { code: await otp.totp() }, headers })).ok()).toBeTruthy();
  const sql = sqlClient();
  await sql`INSERT INTO user_roles (user_id, role) SELECT id, ${role} FROM users WHERE email = ${email}`;
  await sql.end();
}

test("a manager creates a product with photo, sizes and prices, publishes it and it appears in the shop", async ({ page, baseURL, isMobile }) => {
  test.skip(!!isMobile, "admin editing is tested on desktop");
  await signInAsStaff(page, baseURL!, "manager");
  const name = `Cargo Pant ${Date.now().toString(36)}`;

  await page.goto("/admin/products/new");
  await page.getByRole("textbox", { name: "Name", exact: true }).fill(name);
  await page.getByLabel("Description", { exact: true }).fill("Six-pocket cargo pant in ripstop.");
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Upload photos" }).click();
  await (await chooser).setFiles(path.join(__dirname, "../fixtures/product.jpg"));
  await expect(page.getByText("Cover")).toBeVisible({ timeout: 30_000 });

  // the checklist says what is missing before publishing
  await expect(page.getByText("USD price on every variant: missing")).toBeAttached();
  for (const s of ["M", "L"]) await page.getByRole("button", { name: s, exact: true }).click();
  await page.getByLabel("Price USD for all").fill("149");
  await page.getByLabel("Stock for all").fill("3");
  await page.getByRole("button", { name: "Create variants" }).click();
  await expect(page.getByText("2 variant(s) added")).toBeVisible();

  await page.getByRole("button", { name: "Save and publish" }).click();
  await page.waitForURL(/\/admin\/products\/[0-9a-f-]{36}/);
  await expect(page.getByText("Published · saved").filter({ visible: true })).toBeVisible();

  const slug = name.toLowerCase().replace(/\s+/g, "-");
  await page.goto(`/products/${slug}`);
  await expect(page.getByRole("heading", { name })).toBeVisible();
  await expect(page.getByText("$149.00").first()).toBeVisible();

  // stock adjustment with a reason shows up in the inventory history
  await page.goto(`/admin/inventory?q=${encodeURIComponent(slug.toUpperCase())}`);
  await page.getByRole("button", { name: "Adjust" }).first().click();
  await page.getByLabel("Units").fill("2");
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page.getByText(/On hand now 5/)).toBeVisible();
  await expect(page.getByText("Received from production").filter({ visible: true }).first()).toBeVisible();
});

test("a content editor can see products but not edit them, and cannot open inventory", async ({ page, baseURL, isMobile }) => {
  test.skip(!!isMobile, "desktop only");
  await signInAsStaff(page, baseURL!, "content_editor");
  await page.goto("/admin/products");
  await expect(page.getByRole("heading", { name: "Products" })).toBeVisible();
  await expect(page.getByRole("link", { name: "New product" })).toHaveCount(0);
  await page.goto("/admin/inventory");
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
});
