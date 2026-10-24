import { base32 } from "@better-auth/utils/base32";
import { createOTP } from "@better-auth/utils/otp";
import { expect, test, type APIRequestContext } from "@playwright/test";
import postgres from "postgres";

// Rate limiting (3 sign-ups / 5 sign-ins per minute per IP) is real in these tests, so the
// counters are cleared between tests. This only ever touches the TEST database.
test.beforeEach(async () => {
  const url = process.env.TEST_DATABASE_URL;
  if (!url || !new URL(url).pathname.includes("test")) throw new Error("TEST_DATABASE_URL must point at a test database");
  const sql = postgres(url, { max: 1 });
  await sql`DELETE FROM rate_limits`;
  await sql.end();
});

const password = "end to end password 2026";
const uniqueEmail = (tag: string) => `e2e-${tag}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.test`;

async function signUp(request: APIRequestContext, baseURL: string, email: string) {
  const res = await request.post("/api/auth/sign-up/email", {
    data: { email, password, name: "E2E" },
    headers: { origin: baseURL },
  });
  expect(res.ok()).toBeTruthy();
}

async function enableTotp(request: APIRequestContext, baseURL: string) {
  const res = await request.post("/api/auth/two-factor/enable", {
    data: { password, method: "totp" },
    headers: { origin: baseURL },
  });
  expect(res.ok()).toBeTruthy();
  const { totpURI } = (await res.json()) as { totpURI: string };
  const secret = new URL(totpURI).searchParams.get("secret")!;
  const otp = createOTP(new TextDecoder().decode(base32.decode(secret)));
  const verify = await request.post("/api/auth/two-factor/verify-totp", {
    data: { code: await otp.totp() },
    headers: { origin: baseURL },
  });
  expect(verify.ok()).toBeTruthy();
}

test("anonymous visitors are sent from /admin to the login page", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/login\?next=%2Fadmin/);
});

test("a signed-in customer gets 'not found' at /admin and never sees the dashboard", async ({ page, baseURL }) => {
  await signUp(page.request, baseURL!, uniqueEmail("customer"));
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  await expect(page.getByText("Paid orders")).toHaveCount(0);
});

test("wrong password shows an error", async ({ page, baseURL }) => {
  const email = uniqueEmail("wrong");
  await signUp(page.request, baseURL!, email);
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("definitely not the password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "incorrect" })).toBeVisible();
});

test("customer signs in from the form and reaches their account", async ({ page, baseURL }) => {
  const email = uniqueEmail("ok");
  await signUp(page.request, baseURL!, email);
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Account" })).toBeVisible();
  await expect(page.getByText(email)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
});

test("with two-factor on, login asks for a code and the code field starts empty", async ({ page, baseURL }) => {
  const email = uniqueEmail("mfa");
  await signUp(page.request, baseURL!, email);
  await enableTotp(page.request, baseURL!);
  await page.context().clearCookies();

  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();

  const code = page.getByLabel("Authentication code");
  await expect(code).toBeVisible();
  // Regression: the typed password must never reappear in the code field.
  await expect(code).toHaveValue("");
  await expect(page.getByText(password)).toHaveCount(0);
});
