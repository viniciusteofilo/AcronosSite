import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { and, desc, eq } from "drizzle-orm";
import {
  emailLog,
  newsletterSubscribers,
  sessions,
  supportRequests,
} from "@/db/schema";
import { createAuth } from "@/server/auth/auth";
import {
  applyNewsletterLink,
  newsletterToken,
  readNewsletterToken,
} from "@/server/email/notify";
import { emailMode, sendEmail } from "@/server/email/send";
import { contactNotificationMessage } from "@/server/email/templates";
import { submitContact, subscribeNewsletter } from "@/server/marketing/forms";
import { saveStoreSettings } from "@/server/store/settings";
import { ctxFor, makeUser, testDb } from "../helpers";

const { db, client } = testDb();
const auth = createAuth(db);
afterAll(() => client.end());
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const mailsTo = (to: string) =>
  db
    .select()
    .from(emailLog)
    .where(eq(emailLog.to, to.toLowerCase()))
    .orderBy(desc(emailLog.createdAt));
const form = (o: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
};
const addr = (p: string) => `${p}-${crypto.randomUUID()}@example.test`;

describe("sending", () => {
  it("without a provider, development keeps the full message in the outbox (not sent)", async () => {
    const to = addr("outbox");
    expect(emailMode()).toBe("outbox");
    expect(
      await sendEmail(db, {
        kind: "test",
        to,
        subject: "Hi",
        html: "<p>x</p>",
        text: "x",
      }),
    ).toBe("not_sent");
    const [m] = await mailsTo(to);
    expect(m).toMatchObject({
      status: "not_sent",
      bodyHtml: "<p>x</p>",
      provider: null,
    });
  });

  it("in production without a provider nothing is sent and no body is kept", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_ENV", "");
    const to = addr("off");
    expect(emailMode()).toBe("off");
    await sendEmail(db, {
      kind: "reset_password",
      to,
      subject: "Reset",
      html: "<a href='secret-link'>",
      text: "secret-link",
    });
    const [m] = await mailsTo(to);
    expect(m.status).toBe("not_sent");
    expect(m.bodyHtml).toBeNull();
  });

  it("with Resend: sends, keeps only metadata; a provider error never throws", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("EMAIL_FROM", "ACRONOS <store@example.test>");
    const calls: RequestInit[] = [];
    vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
      calls.push(init);
      return Response.json({ id: "email_123" });
    });
    const to = addr("resend");
    expect(
      await sendEmail(db, {
        kind: "test",
        to,
        subject: "Hi",
        html: "<p>x</p>",
        text: "x",
        replyTo: "a@example.test",
      }),
    ).toBe("sent");
    expect(JSON.parse(String(calls[0].body))).toMatchObject({
      from: "ACRONOS <store@example.test>",
      to: [to],
      reply_to: "a@example.test",
    });
    expect((calls[0].headers as Record<string, string>).authorization).toBe(
      "Bearer re_test",
    );
    const [m] = await mailsTo(to);
    expect(m).toMatchObject({
      status: "sent",
      providerId: "email_123",
      bodyHtml: null,
    });

    vi.stubGlobal("fetch", async () =>
      Response.json({ message: "domain not verified" }, { status: 403 }),
    );
    const to2 = addr("resend-fail");
    expect(
      await sendEmail(db, {
        kind: "test",
        to: to2,
        subject: "Hi",
        html: "x",
        text: "x",
      }),
    ).toBe("failed");
    expect((await mailsTo(to2))[0]).toMatchObject({
      status: "failed",
      error: "Resend 403: domain not verified",
    });
  });

  it("escapes what people typed", () => {
    const m = contactNotificationMessage({
      name: "<script>x</script>",
      email: "a@b.c",
      topic: "other",
      message: '"><img src=x onerror=alert(1)>',
    });
    expect(m.html).not.toContain("<script>x");
    expect(m.html).not.toContain("<img src=x");
    expect(m.html).toContain("&lt;script&gt;");
  });
});

describe("newsletter double opt-in", () => {
  it("signed links: confirm expires, cannot be tampered or reused for another purpose", () => {
    const t = newsletterToken("Ana@Example.test", "confirm", 1_000);
    expect(readNewsletterToken(t, "confirm", 2_000)).toBe("ana@example.test");
    expect(readNewsletterToken(t, "unsubscribe", 2_000)).toBeNull();
    expect(
      readNewsletterToken(t, "confirm", 1_000 + 8 * 86_400_000),
    ).toBeNull();
    const parts = t.split(".");
    parts[0] = Buffer.from("eve@example.test").toString("base64url");
    expect(readNewsletterToken(parts.join("."), "confirm", 2_000)).toBeNull();
    expect(
      readNewsletterToken(
        newsletterToken("a@example.test", "unsubscribe", 0),
        "unsubscribe",
        Date.now() + 10 * 365 * 86_400_000,
      ),
    ).toBe("a@example.test");
  });

  it("sign-up sends a confirmation; only the link confirms; unsubscribe works and a new sign-up asks again", async () => {
    const email = addr("news");
    const ip = crypto.randomUUID();
    await subscribeNewsletter(db, form({ email, consent: "on" }), ip);
    const [mail] = await mailsTo(email);
    expect(mail.kind).toBe("newsletter_confirm");
    const token = decodeURIComponent(
      /\/newsletter\/confirm\?t=([^"&\s]+)/.exec(mail.bodyText!)![1],
    );
    const status = async () =>
      (
        await db
          .select()
          .from(newsletterSubscribers)
          .where(eq(newsletterSubscribers.email, email))
      )[0].status;
    expect(await status()).toBe("pending");
    expect(await applyNewsletterLink(db, token, "confirm")).toBe("done");
    expect(await status()).toBe("confirmed");
    await subscribeNewsletter(db, form({ email, consent: "on" }), ip);
    expect(await mailsTo(email)).toHaveLength(1); // already confirmed: no new e-mail
    expect(
      await applyNewsletterLink(
        db,
        newsletterToken(email, "unsubscribe"),
        "unsubscribe",
      ),
    ).toBe("done");
    expect(await status()).toBe("unsubscribed");
    await subscribeNewsletter(db, form({ email, consent: "on" }), ip);
    expect(await status()).toBe("pending");
    expect(await mailsTo(email)).toHaveLength(2);
    expect(await applyNewsletterLink(db, "garbage", "confirm")).toBe("invalid");
  });
});

describe("contact form", () => {
  it("notifies the team address, with reply-to the person; nothing when no address is set", async () => {
    const owner = ctxFor(
      await makeUser(db, { roles: ["super_admin"], twoFactorEnabled: true }),
      ["super_admin"],
    );
    const team = addr("team");
    await saveStoreSettings(db, owner, { notifyEmail: team });
    const person = addr("person");
    await submitContact(
      db,
      form({
        name: "Ana",
        email: person,
        topic: "wholesale",
        message: "Hello, wholesale question here.",
      }),
      crypto.randomUUID(),
      null,
    );
    const [m] = await mailsTo(team);
    expect(m.kind).toBe("contact_notification");
    expect(m.bodyText).toContain(person);
    const [req] = await db
      .select()
      .from(supportRequests)
      .where(eq(supportRequests.email, person));
    expect(m.ref).toBe(req.id);
    await saveStoreSettings(db, owner, { notifyEmail: "" });
    await submitContact(
      db,
      form({
        name: "Ana",
        email: person,
        topic: "other",
        message: "Second message, no team address.",
      }),
      crypto.randomUUID(),
      null,
    );
    expect(await mailsTo(team)).toHaveLength(1);
  });
});

describe("account e-mails through Better Auth", () => {
  const password = "correct horse battery staple";

  it("sign-up sends a verification link; reset password works once and signs every device out", async () => {
    const email = addr("acct");
    const { user } = await auth.api.signUpEmail({
      body: { email, password, name: "Ana" },
    });
    const [verify] = await mailsTo(email);
    expect(verify.kind).toBe("verify_email");
    expect(verify.bodyText).toMatch(/\/api\/auth\/verify-email\?token=/);

    await auth.api.requestPasswordReset({
      body: { email, redirectTo: "/login/reset" },
    });
    const reset = (await mailsTo(email)).find(
      (m) => m.kind === "reset_password",
    )!;
    const url = new URL(
      /(https?:\/\/\S+\/reset-password\/\S+)/.exec(reset.bodyText!)![1],
    );
    const token = url.pathname.split("/").pop()!;
    expect(url.searchParams.get("callbackURL")).toBe("/login/reset");

    expect(
      (await db.select().from(sessions).where(eq(sessions.userId, user.id)))
        .length,
    ).toBeGreaterThan(0);
    await auth.api.resetPassword({
      body: { newPassword: "a brand new long password", token },
    });
    expect(
      await db.select().from(sessions).where(eq(sessions.userId, user.id)),
    ).toHaveLength(0);
    expect((await mailsTo(email)).map((m) => m.kind)).toContain(
      "password_changed",
    );
    await expect(
      auth.api.resetPassword({
        body: { newPassword: "another long password!", token },
      }),
    ).rejects.toThrow();
    await expect(
      auth.api.signInEmail({ body: { email, password } }),
    ).rejects.toThrow();
    await auth.api.signInEmail({
      body: { email, password: "a brand new long password" },
    });

    // unknown address: same answer, no e-mail
    const ghost = addr("ghost");
    await auth.api.requestPasswordReset({
      body: { email: ghost, redirectTo: "/login/reset" },
    });
    expect(await mailsTo(ghost)).toHaveLength(0);
  });

  it("staff get a sign-in alert from a new browser; customers do not", async () => {
    const staffEmail = addr("staff");
    const { user: staff } = await auth.api.signUpEmail({
      body: { email: staffEmail, password, name: "Staff" },
    });
    const { userRoles } = await import("@/db/schema");
    await db
      .insert(userRoles)
      .values({ userId: staff.id, role: "content_editor" });
    const ua = { "user-agent": "Mozilla/5.0 (Windows NT 10.0) Chrome/140" };
    await auth.api.signInEmail({
      body: { email: staffEmail, password },
      headers: new Headers(ua),
    });
    await auth.api.signInEmail({
      body: { email: staffEmail, password },
      headers: new Headers(ua),
    });
    const alerts = (await mailsTo(staffEmail)).filter(
      (m) => m.kind === "staff_sign_in",
    );
    expect(alerts).toHaveLength(1);
    expect(alerts[0].bodyText).toContain("Chrome on Windows");

    const custEmail = addr("cust");
    await auth.api.signUpEmail({
      body: { email: custEmail, password, name: "Cust" },
    });
    await auth.api.signInEmail({
      body: { email: custEmail, password },
      headers: new Headers(ua),
    });
    expect(
      await db
        .select()
        .from(emailLog)
        .where(
          and(eq(emailLog.to, custEmail), eq(emailLog.kind, "staff_sign_in")),
        ),
    ).toHaveLength(0);
  });
});

describe("changing the account e-mail", () => {
  it("the current address approves, the new address confirms; nothing changes before", async () => {
    const { users } = await import("@/db/schema");
    const password = "correct horse battery staple";
    const oldEmail = addr("old");
    const newEmail = addr("new");
    const signUp = await auth.api.signUpEmail({ body: { email: oldEmail, password, name: "Ana" }, asResponse: true });
    const cookie = signUp.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
    const [u] = await db.select().from(users).where(eq(users.email, oldEmail));
    await db.update(users).set({ emailVerified: true }).where(eq(users.id, u.id));
    const signIn = await auth.api.signInEmail({ body: { email: oldEmail, password }, asResponse: true });
    const headers = new Headers({ cookie: signIn.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ") || cookie });

    await auth.api.changeEmail({ body: { newEmail, callbackURL: "/account?email=changed" }, headers });
    const approve = (await mailsTo(oldEmail)).find((m) => m.kind === "change_email")!;
    expect(approve.bodyText).toContain(newEmail);
    expect((await db.select().from(users).where(eq(users.id, u.id)))[0].email).toBe(oldEmail);

    const step1 = new URL(/(https?:\/\/\S+\/verify-email\?\S+)/.exec(approve.bodyText!)![1]);
    await auth.handler(new Request(step1, { headers }));
    expect((await db.select().from(users).where(eq(users.id, u.id)))[0].email).toBe(oldEmail);
    const confirm = (await mailsTo(newEmail)).find((m) => m.kind === "verify_email")!;
    const step2 = new URL(/(https?:\/\/\S+\/verify-email\?\S+)/.exec(confirm.bodyText!)![1]);
    await auth.handler(new Request(step2, { headers }));
    expect((await db.select().from(users).where(eq(users.id, u.id)))[0]).toMatchObject({ email: newEmail, emailVerified: true });
  });
});

describe("test environment admin at sign-in", () => {
  it("an account created before BOOTSTRAP_ADMIN_EMAIL was set becomes admin at its next sign-in", async () => {
    const { userRoles } = await import("@/db/schema");
    const password = "correct horse battery staple";
    const email = addr("owner");
    vi.stubEnv("APP_ENV", "test");
    vi.stubEnv("BOOTSTRAP_ADMIN_EMAIL", "");
    const { user } = await auth.api.signUpEmail({ body: { email, password, name: "Owner" } });
    const saved = await db.select().from(userRoles).where(eq(userRoles.role, "super_admin"));
    await db.delete(userRoles).where(eq(userRoles.role, "super_admin"));
    try {
      vi.stubEnv("BOOTSTRAP_ADMIN_EMAIL", ` ${email.toUpperCase()} `);
      await auth.api.signInEmail({ body: { email, password } });
      const roles = await db.select().from(userRoles).where(eq(userRoles.userId, user.id));
      expect(roles.map((r) => r.role)).toEqual(["super_admin"]);
    } finally {
      const others = saved.filter((r) => r.userId !== user.id);
      if (others.length) await db.insert(userRoles).values(others).onConflictDoNothing();
    }
  });
});
