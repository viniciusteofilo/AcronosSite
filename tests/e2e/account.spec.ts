import { expect, test } from "@playwright/test";
import postgres from "postgres";

const sqlClient = () => {
  const url = process.env.TEST_DATABASE_URL;
  if (!url || !new URL(url).pathname.includes("test"))
    throw new Error("TEST_DATABASE_URL must point at a test database");
  return postgres(url, { max: 1 });
};

test.beforeEach(async () => {
  const sql = sqlClient();
  await sql`DELETE FROM rate_limits`;
  await sql.end();
});

/** Latest message to an address, from the test outbox (no e-mail provider in tests). */
async function lastMail(to: string, kind: string) {
  const sql = sqlClient();
  const [row] =
    await sql`SELECT body_text FROM email_log WHERE "to" = ${to.toLowerCase()} AND kind = ${kind} ORDER BY created_at DESC LIMIT 1`;
  await sql.end();
  return (row?.body_text as string | undefined) ?? null;
}

test("customer account: sign up, confirm e-mail, addresses, change and reset password", async ({
  page,
  isMobile,
}) => {
  test.setTimeout(120_000);
  const email = `cust-${Date.now()}-${isMobile ? "m" : "d"}@example.test`;
  const password = "first password 2026";

  // create account from the sign-in page
  await page.goto("/login");
  await page.getByRole("link", { name: "Create account" }).click();
  await expect(
    page.getByRole("heading", { name: "Create account" }),
  ).toBeVisible();
  await page.getByLabel("Name").filter({ visible: true }).fill("Ana");
  await page.getByLabel("Email").filter({ visible: true }).fill(email);
  await page.getByLabel("Password").filter({ visible: true }).fill("short");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("Use at least 12 characters.")).toBeVisible();
  await page.getByLabel("Password").filter({ visible: true }).fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(
    page.getByText("Welcome to ACRONOS. Your account is ready."),
  ).toBeVisible();
  await expect(
    page.getByText("Your e-mail is not confirmed yet."),
  ).toBeVisible();

  // confirm through the link in the e-mail
  await expect.poll(() => lastMail(email, "verify_email")).toBeTruthy();
  const verifyUrl = /(https?:\/\/\S+\/api\/auth\/verify-email\?\S+)/.exec(
    (await lastMail(email, "verify_email"))!,
  )![1];
  await page.goto(new URL(verifyUrl).pathname + new URL(verifyUrl).search);
  await expect(
    page.getByText("Thank you, your e-mail is confirmed."),
  ).toBeVisible();

  // address book
  await page.getByRole("link", { name: "Addresses" }).click();
  await page.getByRole("button", { name: "Add address" }).click();
  await page.getByLabel("Full name").filter({ visible: true }).fill("Ana Silva");
  await page.getByLabel("Address", { exact: true }).filter({ visible: true }).fill("100 Main St");
  await page.getByLabel("City").filter({ visible: true }).fill("Orlando");
  await page.getByLabel("Postal code").filter({ visible: true }).fill("32801");
  await page.getByRole("button", { name: "Save address" }).click();
  await expect(page.getByText(/Choose a country/i).last()).toBeVisible();
  await page.getByLabel("Country").filter({ visible: true }).selectOption("US");
  await page.getByRole("button", { name: "Save address" }).click();
  await expect(page.getByText("Address saved.")).toBeVisible();
  await expect(page.locator("address")).toContainText("100 Main St");

  // change password (signs out other devices, e-mails a notice)
  await page.getByRole("link", { name: "Security" }).click();
  await page.getByLabel("Current password").filter({ visible: true }).fill("wrong password here");
  await page.getByLabel(/^New password/).filter({ visible: true }).fill("second password 2026");
  await page.getByLabel("Repeat new password").filter({ visible: true }).fill("second password 2026");
  await page.getByRole("button", { name: "Change password" }).click();
  await expect(
    page.getByText("Your current password is not correct."),
  ).toBeVisible();
  await page.getByLabel("Current password").filter({ visible: true }).fill(password);
  await page.getByLabel(/^New password/).filter({ visible: true }).fill("second password 2026");
  await page.getByLabel("Repeat new password").filter({ visible: true }).fill("second password 2026");
  await page.getByRole("button", { name: "Change password" }).click();
  await expect(
    page.getByText("Password changed. Other devices were signed out."),
  ).toBeVisible();
  expect(await lastMail(email, "password_changed")).toBeTruthy();

  // forgot password, signed out
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByRole("link", { name: "Forgot your password?" }).click();
  // wait for the new page: the previous one stays in the DOM (hidden) and a field found too early never becomes visible
  await expect(page.getByRole("heading", { name: "Reset password" })).toBeVisible();
  await page.getByLabel("Email").filter({ visible: true }).fill(email);
  await page.getByRole("button", { name: "Send link" }).click();
  await expect(
    page.getByText(/If there is an account for that address/),
  ).toBeVisible();
  await expect.poll(() => lastMail(email, "reset_password")).toBeTruthy();
  const resetUrl = new URL(
    /(https?:\/\/\S+\/reset-password\/\S+)/.exec(
      (await lastMail(email, "reset_password"))!,
    )![1],
  );
  await page.goto(resetUrl.pathname + resetUrl.search);
  await expect(
    page.getByRole("heading", { name: "New password" }),
  ).toBeVisible();
  await page.getByLabel("New password", { exact: true }).filter({ visible: true }).fill("third password 2026!");
  await page.getByLabel("Repeat new password").filter({ visible: true }).fill("third password 2026!");
  await page.getByRole("button", { name: "Save password" }).click();
  await expect(page.getByText(/Your password was changed/)).toBeVisible();

  await page.getByRole("link", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await page.getByLabel("Email").filter({ visible: true }).fill(email);
  await page.getByLabel("Password").filter({ visible: true }).fill("third password 2026!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Account" })).toBeVisible();
});

test("newsletter: sign-up e-mails a link; the link page needs a click to confirm", async ({
  page,
  isMobile,
}) => {
  test.skip(!!isMobile, "desktop only");
  const email = `news-${Date.now()}@example.test`;
  await page.goto("/");
  const footer = page.getByRole("form", { name: "Newsletter" }).last();
  await footer.getByPlaceholder("Email address").fill(email);
  await footer.getByRole("checkbox").check();
  await footer.getByRole("button", { name: "Subscribe" }).click();
  await expect(page.getByText(/We will e-mail you to confirm/).last()).toBeVisible();
  await expect.poll(() => lastMail(email, "newsletter_confirm")).toBeTruthy();
  const link = new URL(
    /(https?:\/\/\S+\/newsletter\/confirm\?t=\S+)/.exec(
      (await lastMail(email, "newsletter_confirm"))!,
    )![1],
  );
  await page.goto(link.pathname + link.search);
  const sql = sqlClient();
  const status = async () =>
    (
      await sql`SELECT status FROM newsletter_subscribers WHERE email = ${email}`
    )[0].status;
  expect(await status()).toBe("pending"); // opening the link alone changes nothing
  await page.getByRole("button", { name: "Confirm subscription" }).click();
  await expect(
    page.getByText("Subscription confirmed. Thank you."),
  ).toBeVisible();
  expect(await status()).toBe("confirmed");
  await sql.end();
});
