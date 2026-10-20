# Security

Reference: OWASP ASVS level 2 and OWASP Top 10. No system is immune to attack; the goal is a small attack surface, early detection and limited damage.

## Controls in place (Phase 01)

- **Authentication:** Better Auth (maintained library). Passwords hashed, never stored in plain text (tested). Minimum 12 characters.
- **Two-factor:** TOTP for every staff account, enforced on the server before any admin page or action. 10 single-use backup codes. Account lock after repeated wrong codes (library default: 10).
- **Sessions:** HttpOnly cookies, `Secure` in production, SameSite=Lax. Admin access refused when the session is older than 8 hours.
- **Authorization:** `decideStaffAccess` (server/rbac/access.ts) runs for every admin request; roles are read from the database, never from the client. Customer queries are filtered by the session's user id.
- **Brute force:** rate limits kept in the database (shared across server instances).
- **CSRF:** origin check on auth endpoints (requests from another origin get 403); SameSite cookies.
- **Open redirect:** `safeNextPath` allows only same-site paths after login.
- **Injection:** Drizzle ORM parameterized queries only; Zod validation on every write.
- **Audit:** append-only `audit_logs`, enforced by a database trigger.
- **Headers:** CSP, HSTS, X-Content-Type-Options, X-Frame-Options/frame-ancestors, Referrer-Policy, Permissions-Policy; `X-Powered-By` removed.
- **Secrets:** environment variables only; `.env*` git-ignored. Payment keys are never stored in the database.
- **Supply chain:** `npm audit` in CI, Dependabot weekly.

## Recovering admin access

1. Lost phone: sign in with a backup code, then set up two-factor again from `/account/security`.
2. No backup codes: another super admin removes the user's two-factor (Phase 04 screen; audited). Keep **two** super admins.
3. Only super admin locked out: an operator with database access follows the documented break-glass procedure (Phase 07 runbook), recorded in the audit log.

## Incident response (summary)

1. **Contain:** revoke sessions (`DELETE FROM sessions`), rotate `BETTER_AUTH_SECRET` and provider keys, disable affected accounts.
2. **Assess:** read `audit_logs` and provider dashboards; identify data and period affected.
3. **Fix** the cause, deploy, verify with tests.
4. **Notify** customers and authorities when the law requires it (LGPD in Brazil; US state laws for US customers) — with legal advice.
5. **Review** and add a regression test.

## Residual risks

- Phishing of a staff member's password and code in real time (mitigation planned: sign-in alerts, WebAuthn/passkeys later).
- Provider outage (Cloudflare, Neon, Stripe, PayPal).
- A new vulnerability in a dependency before a patch exists.
- Inline-script CSP until nonces are introduced (Phase 06).

Report a vulnerability privately to the ACRONOS team; do not open a public issue.
