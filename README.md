# ACRONOS — Website 3.0

E-commerce, CMS and admin panel for ACRONOS. Owned by the company: no platform subscription.

**Stack:** Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · PostgreSQL · Drizzle ORM · Better Auth (TOTP two-factor) · Zod · Vitest · Playwright.
**Planned hosting:** Cloudflare Workers + Neon Postgres + Cloudflare R2 (see the Phase 01 architecture document).

> Current phase: **01 — Foundation.** The public storefront, checkout and payments are not built yet.
> See [docs/STATUS.md](docs/STATUS.md) for exactly what is implemented, mocked, planned or blocked.

## Run locally

Requirements: Node.js 20.9+ (22 recommended) and PostgreSQL 16.

```bash
npm install
cp .env.example .env.local          # then set BETTER_AUTH_SECRET (openssl rand -base64 32)
createdb acronos_dev && createdb acronos_test
npm run db:migrate                  # creates all tables
npm run admin:create -- --email you@company.com --name "Your Name"   # first super admin, password at the prompt
npm run dev                         # http://localhost:3000
```

Then sign in at `/login`, open `/account/security`, turn on two-factor authentication with an authenticator app,
and open `/admin`. Staff accounts cannot open the admin panel without two-factor.

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` / `build` / `start` | Develop, build, run the production build |
| `npm run lint` / `typecheck` | ESLint and TypeScript |
| `npm test` | Unit + integration tests against a real, separate PostgreSQL (`TEST_DATABASE_URL`, wiped each run) |
| `npm run test:e2e` | Browser tests (desktop + mobile) against the production build; run `npm run build` first |
| `npm run db:generate` | Create a migration after changing `db/schema` |
| `npm run db:migrate` | Apply pending migrations |
| `npm run admin:create` | Bootstrap the first super admin (refuses if one exists) |

## Project layout

```
app/            routes (storefront, /account, /admin, /api/auth)
server/         business rules — server only (auth, rbac, audit, reports, customers)
db/schema/      tables (auth, rbac, audit, commerce, content)   db/migrations/  versioned SQL
components/     UI (design system tokens live in app/globals.css)
lib/            shared helpers (money, safe redirects, auth client)
tests/          unit/, integration/ (real Postgres), e2e/ (Playwright)
docs/           STATUS.md, SECURITY.md
assets/fonts/   self-hosted Inter, Space Mono, Orbitron (SIL OFL)
```

## Rules for contributors

- Secrets only in environment variables. `.env*` files are git-ignored (except `.env.example`).
- Pages and actions call `requireStaff(permission)` / `requireUser()` on the server. Hiding a link is not protection.
- Every write is validated with Zod on the server; money is integer minor units + currency code.
- Sensitive changes write to `audit_logs` in the same transaction. The table is append-only (database trigger).
- Never put real products, prices, orders or invented content in seeds or fixtures.
