import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { captcha, twoFactor } from "better-auth/plugins";
import { turnstileEnabled } from "@/server/security/turnstile";
import type { Database } from "@/db/client";
import * as schema from "@/db/schema";
import { siteUrl } from "@/lib/site-url";
import { sendEmail } from "@/server/email/send";
import { passwordChangedMessage, resetPasswordMessage, verifyEmailMessage } from "@/server/email/templates";
import { alertStaffSignIn } from "./alerts";
import { bootstrapTestAdmin } from "./bootstrap";

/**
 * Authentication is delegated to Better Auth (maintained library): password hashing,
 * sessions, cookies and TOTP two-factor. No custom cryptography lives in this repo.
 */
export function createAuth(db: Database) {
  return betterAuth({
    appName: "ACRONOS",
    secret: process.env.BETTER_AUTH_SECRET,
    baseURL: process.env.BETTER_AUTH_URL || siteUrl(),
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: {
        user: schema.users,
        session: schema.sessions,
        account: schema.accounts,
        verification: schema.verifications,
        twoFactor: schema.twoFactors,
        rateLimit: schema.rateLimits,
      },
    }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
      resetPasswordTokenExpiresIn: 60 * 60,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => {
        await sendEmail(db, { kind: "reset_password", to: user.email, ref: user.id, ...resetPasswordMessage(user.name, url) });
      },
      onPasswordReset: async ({ user }) => {
        await sendEmail(db, { kind: "password_changed", to: user.email, ref: user.id, ...passwordChangedMessage(user.name) });
      },
    },
    emailVerification: {
      // sign-up is never blocked by e-mail (the store may run without a provider); unverified
      // accounts see a reminder in their account page
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      expiresIn: 60 * 60 * 24,
      sendVerificationEmail: async ({ user, url }) => {
        await sendEmail(db, { kind: "verify_email", to: user.email, ref: user.id, ...verifyEmailMessage(user.name, url) });
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7, // 7 days for customers; admin access is shortened in the RBAC guard
      updateAge: 60 * 60 * 24,
    },
    rateLimit: {
      enabled: true,
      storage: "database", // shared across server instances (edge isolates do not share memory)
      window: 60,
      max: 100,
      customRules: {
        "/sign-in/email": { window: 60, max: 5 },
        "/sign-up/email": { window: 60, max: 3 },
        "/two-factor/verify-totp": { window: 60, max: 5 },
        "/two-factor/verify-backup-code": { window: 60, max: 5 },
        "/request-password-reset": { window: 600, max: 3 },
        "/send-verification-email": { window: 600, max: 3 },
        "/change-password": { window: 60, max: 5 },
      },
    },
    advanced: {
      useSecureCookies: process.env.NODE_ENV === "production",
      database: { generateId: "uuid" },
      ipAddress: { ipAddressHeaders: ["cf-connecting-ip", "x-forwarded-for"] },
    },
    databaseHooks: {
      user: { create: { after: async (user) => bootstrapTestAdmin(db, user) } },
      session: { create: { after: async (session) => alertStaffSignIn(db, session) } },
    },
    plugins: [
      twoFactor({ issuer: "ACRONOS" }),
      // bot check on account creation and password-reset requests, once Turnstile keys are set
      ...(turnstileEnabled()
        ? [captcha({ provider: "cloudflare-turnstile", secretKey: process.env.TURNSTILE_SECRET_KEY!, endpoints: ["/sign-up/email", "/request-password-reset"] })]
        : []),
      nextCookies(),
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;
