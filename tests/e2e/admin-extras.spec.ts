import { base32 } from "@better-auth/utils/base32";
import { createOTP } from "@better-auth/utils/otp";
import { expect, test, type Page } from "@playwright/test";
import postgres from "postgres";

const sqlClient = () => {
  const url = process.env.TEST_DATABASE_URL;
  if (!url || !new URL(url).pathname.includes("test"))
    throw new Error("TEST_DATABASE_URL must point at a test database");
  return postgres(url, { max: 1 });
};

async function signInAsOwner(page: Page, baseURL: string) {
  const sql = sqlClient();
  await sql`DELETE FROM rate_limits`;
  const email = `owner-${Date.now()}@example.test`;
  const password = "owner password 2026";
  const headers = { origin: baseURL };
  expect(
    (
      await page.request.post("/api/auth/sign-up/email", {
        data: { email, password, name: "Owner" },
        headers,
      })
    ).ok(),
  ).toBeTruthy();
  const { totpURI } = (await (
    await page.request.post("/api/auth/two-factor/enable", {
      data: { password, method: "totp" },
      headers,
    })
  ).json()) as { totpURI: string };
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
  await sql`INSERT INTO user_roles (user_id, role) SELECT id, 'super_admin' FROM users WHERE email = ${email}`;
  await sql.end();
  return email;
}

test("Sci-Fi import: Word and Markdown files become drafts", async ({
  page,
  baseURL,
  isMobile,
}) => {
  test.skip(!!isMobile, "admin runs on desktop");
  await signInAsOwner(page, baseURL!);
  await page.goto("/admin/sci-fi");
  await page.getByRole("link", { name: "Import files" }).click();
  await page
    .getByLabel("Choose story files")
    .setInputFiles(["tests/fixtures/story.docx", "tests/fixtures/story.md"]);
  await expect(page.getByLabel("Title for story.docx")).toHaveValue(
    "Gate Seven",
  );
  await expect(page.getByLabel("Title for story.md")).toHaveValue(
    "Concrete Rain",
  );
  await page.getByRole("button", { name: "Import 2 as drafts" }).click();
  await expect(page.getByText("Enter the author's name.")).toBeVisible();
  await page.getByLabel(/^Author/).fill("Test Author");
  await page.getByRole("button", { name: "Import 2 as drafts" }).click();
  await expect(page.getByText("2 drafts created.")).toBeVisible();
  await page.getByRole("link", { name: "Draft created" }).first().click();
  await expect(page.getByLabel(/^Title/).filter({ visible: true }).first()).toHaveValue(
    "Gate Seven",
  );
  const sql = sqlClient();
  const [s] =
    await sql`SELECT status, body FROM stories WHERE title = 'Gate Seven' ORDER BY created_at DESC LIMIT 1`;
  await sql.end();
  expect(s.status).toBe("draft");
  expect(s.body).toContain("<em>Nobody</em>");
  expect(s.body).toContain("<h2>Part two</h2>");
});

test("E-mails screen: test outbox shows messages without sending", async ({
  page,
  baseURL,
  isMobile,
}) => {
  test.skip(!!isMobile, "admin runs on desktop");
  const email = await signInAsOwner(page, baseURL!);
  await page.goto("/admin/emails");
  await expect(page.getByText("Not connected: nothing is sent.")).toBeVisible();
  await page.getByRole("button", { name: "Send test e-mail to me" }).click();
  await expect(page.getByText(/Recorded in the list below/)).toBeVisible();
  await page.getByLabel("Team e-mail for new messages").fill("not-an-email");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Enter a valid e-mail address.")).toBeVisible();
  await page.getByRole("link", { name: "ACRONOS test e-mail" }).first().click();
  await expect(
    page.getByRole("heading", { name: "ACRONOS test e-mail" }),
  ).toBeVisible();
  await expect(
    page
      .frameLocator('iframe[title="E-mail content"]')
      .getByText("If you can read this, the store can send e-mails."),
  ).toBeVisible();
  expect(email).toContain("@");
});
