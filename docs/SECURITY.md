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

## Added in Phase 05–06

- **Payments:** hosted checkouts only (no card data here).
  - An order is marked paid only by a verified provider confirmation: a Stripe signature on the raw body, or a PayPal capture plus PayPal webhook verification.
  - Each event is processed once.
  - Amounts are checked against the order.
- **Stock abuse:** checkout attempts are limited per IP (10 per 15 min). Adding to the cart is limited (60 per 10 min). An online order holds at most 30 units, and holds expire.
- **Sessions:** every person sees where they are signed in (`/account/security`) and can sign out other devices. This takes effect immediately, because sessions are checked in the database on each request.
- **Privacy (LGPD / GDPR / CCPA):**
  - Customers download their data as JSON and can request erasure.
  - The super admin erases the data in Admin → Privacy requests; the request is due in 15 days.
  - Orders are kept for tax law; everything else personal is deleted or anonymized.
  - Each step is audited.
- **Exports:** the newsletter and order CSVs are audited and protected against spreadsheet formula injection.
- **Backups:**
  - `scripts/backup.sh` writes a compressed dump with a checksum.
  - `scripts/restore-check.sh` restores it into a scratch database and compares every table's row count.
  - Drill run on 2026-10-21: OK.
  - Neon point-in-time recovery is added in Phase 07.

## Added with store e-mails and bot check (2026-10-23)

- **Account recovery:** password reset links expire after 1 hour and work once; every device is signed out after a reset or a password change, and the person gets a notice by e-mail. "Forgot password" and sign-up give the same answer whether or not an address has an account.
- **Staff sign-in alert:** a staff member gets an e-mail when their account signs in from a browser it had no session on.
- **E-mail content:** with a real provider only recipient, subject and status are stored. Full messages (with links) are stored only in the test outbox; the outbox screen is limited to super admins and shows messages in a sandboxed frame.
- **Newsletter links:** confirm/unsubscribe links are signed with the server secret (confirm expires in 7 days); opening a link changes nothing until the person presses the button, so e-mail scanners cannot confirm or cancel.
- **Bot check:** Cloudflare Turnstile on contact, newsletter, sign-up and password-reset requests once `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` are set (free; needs the Cloudflare account). Verification fails closed. Without keys, the honeypot field and per-IP rate limits remain.

## Content Security Policy decision (2026-10-21)

- **Scripts keep `'unsafe-inline'`.** Next.js streams page data in inline scripts.
- **Why not nonces:** they would make every page render per request. That disables static shells and CDN caching, and the Next.js documentation says this is incompatible with partial prerendering.
- **Why not hashes:** we tested hash-based Subresource Integrity with `script-src 'self'`. The browser blocked the framework's inline scripts.
- **Compensating controls:**
  - No third-party scripts.
  - React escaping everywhere.
  - Rich text (stories) sanitized on save and on render.
  - `object-src 'none'`, `base-uri 'self'` and `frame-ancestors 'none'`.
  - `form-action` limited to this site and the payment providers.
  - `connect-src 'self'`.
- **Review again** when Next.js supports hashes for streamed scripts.

## Recovering admin access

1. Lost phone: sign in with a backup code, then set up two-factor again from `/account/security`.
2. No backup codes: another super admin uses Admin → Users → "Reset (lost phone)" (turns two-factor off and signs the person out everywhere; audited). Keep **two** super admins.
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
- Inline scripts allowed by the CSP (see decision above).
- Sign-in alerts by e-mail wait for an e-mail provider; until then staff review their sessions on `/account/security`.

Report a vulnerability privately to the ACRONOS team; do not open a public issue.
