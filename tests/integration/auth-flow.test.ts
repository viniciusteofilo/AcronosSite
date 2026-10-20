import { afterAll, describe, expect, it } from "vitest";
import { base32 } from "@better-auth/utils/base32";
import { createOTP } from "@better-auth/utils/otp";
import { eq } from "drizzle-orm";
import { accounts, users } from "@/db/schema";
import { createAuth } from "@/server/auth/auth";
import { testDb } from "../helpers";

const { db, client } = testDb();
const auth = createAuth(db);
afterAll(() => client.end());

const password = "correct horse battery staple";

function cookieHeaders(setCookie: string | null): Headers {
  const h = new Headers();
  if (setCookie) {
    h.set(
      "cookie",
      setCookie
        .split(/,(?=\s*[\w.-]+=)/)
        .map((c) => c.split(";")[0].trim())
        .join("; "),
    );
  }
  return h;
}

function codeFromUri(uri: string) {
  const secret = new URL(uri).searchParams.get("secret")!;
  const raw = new TextDecoder().decode(base32.decode(secret));
  return createOTP(raw).totp();
}

describe("authentication with Better Auth", () => {
  it("never stores the password in plain text", async () => {
    const email = `hash-${crypto.randomUUID()}@example.test`;
    const { user } = await auth.api.signUpEmail({ body: { email, password, name: "Hash Test" } });
    const [acc] = await db.select().from(accounts).where(eq(accounts.userId, user.id));
    expect(acc.password).toBeTruthy();
    expect(acc.password).not.toContain(password);
  });

  it("rejects short passwords", async () => {
    await expect(
      auth.api.signUpEmail({
        body: { email: `short-${crypto.randomUUID()}@example.test`, password: "short", name: "x" },
      }),
    ).rejects.toThrow();
  });

  it("rejects a wrong password", async () => {
    const email = `wrong-${crypto.randomUUID()}@example.test`;
    await auth.api.signUpEmail({ body: { email, password, name: "Wrong" } });
    await expect(auth.api.signInEmail({ body: { email, password: "not the password at all" } })).rejects.toThrow();
  });

  it("after enabling TOTP, signing in requires the second factor", async () => {
    const email = `mfa-${crypto.randomUUID()}@example.test`;
    const signUp = await auth.api.signUpEmail({
      body: { email, password, name: "MFA Test" },
      returnHeaders: true,
    });
    const headers = cookieHeaders(signUp.headers.get("set-cookie"));

    const enabled = await auth.api.enableTwoFactor({ body: { password, method: "totp" }, headers });
    expect("totpURI" in enabled).toBe(true);
    if (!("totpURI" in enabled)) return;
    expect(enabled.backupCodes.length).toBeGreaterThan(0);

    await auth.api.verifyTOTP({ body: { code: await codeFromUri(enabled.totpURI) }, headers });
    const [u] = await db.select().from(users).where(eq(users.email, email));
    expect(u.twoFactorEnabled).toBe(true);

    const signIn = await auth.api.signInEmail({ body: { email, password } });
    expect(signIn).toMatchObject({ twoFactorRedirect: true });
    expect("token" in signIn && signIn.token).toBeFalsy();
  });
});
