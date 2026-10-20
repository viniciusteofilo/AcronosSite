# Status — Phase 03 Storefront + Site editor

Updated 2026-10-20. Legend: **IMPLEMENTED** (built and covered by automated tests) · **MOCKED** (works with simulated data or services) · **PLANNED** (designed, not built) · **BLOCKED** (waiting on a decision, account or file from ACRONOS).

Nothing in this repository is MOCKED. Screens that are not built say so ("Phase 04/05") instead of pretending to work.

## Implemented

| Area | What exists | Proof |
| --- | --- | --- |
| Project | Next.js 16 + TypeScript + Tailwind, folder structure from the architecture doc | `npm run build`, `npm run typecheck`, `npm run lint` |
| Database | 45 tables: identity, roles, audit, merchant entities and payment accounts, catalog, variants, price lists per currency, inventory and reservations, carts, orders (separate payment / processing / fulfillment status), payments, webhook events, refunds, coupons, shipping zones (disabled by default), exchange rates, pages, revisions, Sci-Fi stories, Lab projects, newsletter, privacy requests | `db/migrations/0000_initial_schema.sql`, rebuilt from scratch on every test run |
| Database guarantees | Stock can never go negative or be over-reserved; order total must add up; one order per idempotency key; one row per provider webhook event; audit log rejects UPDATE/DELETE/TRUNCATE | `tests/integration/database-guarantees.test.ts`, incl. two concurrent reservations of the last unit |
| Authentication | Email + password (min. 12 chars, hashed by Better Auth), sessions in HttpOnly cookies (Secure in production), TOTP two-factor with QR code and 10 backup codes, rate limiting stored in the database (5 sign-ins / 3 sign-ups per minute per IP), CSRF origin check | `tests/integration/auth-flow.test.ts`, `tests/e2e/auth.spec.ts` |
| Roles and permissions | Super Admin, Manager, Content Editor, Order Manager, Customer; permission matrix in code; staff need two-factor and a session younger than 8 h | `tests/unit/permissions.test.ts` |
| Admin access | `/admin` checked on the server on every request; customers get a 404; staff without 2FA are sent to set it up | `tests/e2e/auth.spec.ts`, `tests/integration/authorization.test.ts` |
| Role management | Grant/revoke roles (super admin only), validated, audited in the same transaction, self lock-out prevented | `tests/integration/authorization.test.ts` |
| First admin | CLI bootstrap, password typed at the prompt, refuses if a super admin exists, audited | manual run documented in README |
| Customer data isolation | A customer cannot read another customer's order by id or in their history | `tests/integration/authorization.test.ts` (fails if the ownership filter is removed) |
| Admin dashboard | Paid orders, revenue per currency, to process, low stock, shipped, canceled, refunded — 7/30/90 days, straight from the database (zero today) | `tests/integration/authorization.test.ts` |
| Account | `/account` (order history, links), `/account/security` (enable 2FA), sign out | e2e |
| Security headers | CSP, HSTS, nosniff, frame-ancestors none / X-Frame-Options DENY, Referrer-Policy, Permissions-Policy | `curl -I` |
| CI | GitHub Actions: lint, typecheck, unit + integration on PostgreSQL 16, build, e2e (desktop + mobile), `npm audit`; Dependabot weekly | `.github/` |
| Design tokens | Colors and fonts from the design system; fonts self-hosted; focus ring; reduced motion | `app/globals.css` |

## Phase 03 — Storefront and site editor

| Area | What exists | Proof |
| --- | --- | --- |
| Storefront | Home, Shop (filters: category, size, color, price, stock; sort; search; pagination), Product (variant picker, availability, related, JSON-LD), Collections and collection page, About, Acronos Lab, Sci-Fi library and story reader, policies, contact, cart page | `tests/e2e/store.spec.ts` |
| Data rules | Only published products with a USD price whose publish time has passed are shown; drafts, future and unpriced products are hidden; sold-out sizes disabled | `tests/integration/storefront.test.ts` |
| Site editor (`/admin/site`) | Homepage campaign editor: photos (drag-and-drop, from library, remove, focal point, alt text), all texts and buttons, featured products (newest or hand-picked), draft, preview, publish now, schedule for a date/time (goes live automatically), history with restore | integration + e2e (editor publishes, home changes) |
| Image library (`/admin/media`) | Bulk upload, resized in the browser to WebP 640/1280/2400 px, alt text; server checks WebP signature and real dimensions, size limits, staff permission, same-origin | integration tests |
| Forms | Newsletter (explicit consent, honeypot, rate limit, consent time and source stored, no enumeration); contact form stored as support request; typed values kept after errors | integration + e2e |
| SEO | Per-page titles and descriptions, canonical URLs, sitemap.xml (published items only), robots.txt (admin, account, cart excluded), Product JSON-LD | build output |
| Story safety | Story HTML sanitized (no scripts, handlers, iframes; links get rel=noopener) | integration test |

**Empty states (by design):** with no published products, collections or stories, each page says what will appear there. Policies say they are being finalized; no legal text is invented.

**Still PLANNED:** product, collection, story, Lab and page editors (Phase 04); cart and checkout (Phase 05); confirmation e-mails (needs an e-mail provider); R2 image storage (Phase 07).

## Phase 02 — Design system (approved 2026-10-20)

Direction change on 2026-10-20: light theme (light gray canvas, near-black ink), requested by ACRONOS. Official logo added as a vector trace of the supplied artwork (® omitted until registration is confirmed).

| Area | What exists | Proof |
| --- | --- | --- |
| Components | Icons, brand graphic elements, buttons (5 variants), fields with hint/error, checkbox, size/color pickers (native radios, sold-out announced), quantity stepper, badges, product card, media placeholder | `/design-preview` style guide |
| Storefront chrome | Header (desktop nav with current page; mobile drawer on native `<dialog>`: focus trap, Escape, inert background), footer with newsletter form (UI only) | `tests/e2e/design-preview.spec.ts` |
| Approval screens | Home, Shop with filters, Product, Collections, Sci-Fi reading page — desktop and mobile, no horizontal scroll | screenshots in the review page |
| Gating | `/design-preview` is never indexed and is excluded from builds unless `DESIGN_PREVIEW=1` at build time | `app/design-preview/layout.tsx` |

**MOCKED (labeled on screen):** every image is a placeholder slot with its recommended size; products are "SAMPLE // …" at $000.00; collection names and statements are placeholders; the manifesto is draft copy. Newsletter, search, cart and filters do not submit yet (Phase 03/05).

## Planned (next phases)

| Phase | Items |
| --- | --- |
| 03 Storefront | Home, Shop with filters and search, product, collections, About, Lab, Sci-Fi |
| 04 Admin | Products/variants/prices/images, inventory adjustments, collections, customers, CMS with drafts/preview/revisions, Sci-Fi editor and importer, Lab, marketing, reports, settings, user management screen |
| 05 E-commerce | Cart, checkout, server-side pricing, stock reservation with expiry, Stripe Checkout (with Adaptive Pricing) and PayPal, signed webhooks, refunds, reconciliation, transactional e-mail, import-duty line (DDP) |
| 06 Security & testing | Nonce-based CSP, Turnstile on forms, admin sign-in alerts, backup/restore drill, accessibility audit (WCAG 2.2 AA), Core Web Vitals |
| 07 Deployment | Cloudflare Workers + Neon + R2, staging and production, monitoring, daily backups, domain |

## Blocked (needs ACRONOS)

- Original vector logo files (SVG/PDF). A faithful vector trace of the supplied PNG is in use until then.
- Stripe Brasil and PayPal Brasil business accounts (CNPJ), verified.
- Domain without .br, to configure as the official URL.
- DDP vs DDU, carrier and HS codes for exports (accountant / customs broker).
- Product photos and content from the old site, if any was saved.
- Trademark registration status before using ®.
- Legal review of privacy, terms, shipping and returns policies.

## Known limitations

- Admin and account pages stream their content, so an unauthorized request returns HTTP 200 with the 404/redirect delivered in the stream (no data is sent). Requests without a session cookie are redirected with a real 307 by `proxy.ts`.
- CSP still allows inline scripts (framework bootstrap); nonce-based CSP is planned for Phase 06.
- `npm audit` reports 4 moderate issues in `drizzle-kit`'s bundled esbuild (development tool only, not shipped to production).
- The database driver is `postgres-js`; the Cloudflare runtime driver (Neon serverless / Hyperdrive) is swapped in `db/client.ts` in Phase 07.
