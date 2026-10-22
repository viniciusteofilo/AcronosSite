# Status — Phase 07 Deployment (ready, waiting for accounts)

Updated 2026-10-22. Legend: **IMPLEMENTED** (built and covered by automated tests) · **MOCKED** (works with simulated data or services) · **PLANNED** (designed, not built) · **BLOCKED** (waiting on a decision, account or file from ACRONOS).

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

## Campaign film on the homepage (scroll-controlled)

| Feature | Status | Notes |
|---|---|---|
| Upload a short video in Site editor → "0. Campaign film" | **IMPLEMENTED** | The admin's browser cuts the video into WebP frames (12 per second, up to 12 s; 1600 px for computers, 800 px for phones) and uploads them in batches. MP4 (H.264) in Chrome/Edge/Firefox; Safari cannot create WebP, so use another browser for the upload. |
| Server checks | **IMPLEMENTED** | Content staff only, same-origin, real WebP with the declared size, max 700 KB per frame, film published only when every frame exists. |
| Film on the homepage | **IMPLEMENTED** | Plays as the visitor scrolls, under the header; caption on its own band (no text on the film); "Skip" link; frames load after the page, phones get the small ones. Reduced motion or data saver: first frame only. Removing the film brings back the photo opening. |
| Placeholder film | **MOCKED** | Made by Claude (concrete corridor and the ACRONOS symbol) to show the effect; to be replaced by the real campaign video. |
| Cleanup of replaced films | **PLANNED** | Old frames stay in storage when a film is replaced; a cleanup job will remove unused ones. |

## Phase 07 — Deployment (prepared; BLOCKED on ACRONOS accounts)

| Area | What exists | Proof |
| --- | --- | --- |
| Cloudflare build | OpenNext adapter, `wrangler.jsonc`, custom Worker with cron, R2 page cache | local Workers runtime preview 2026-10-22 |
| Database on Workers | One client per request through Hyperdrive; Better Auth per request; Node path unchanged for dev/tests | preview: sign-in with 2FA, admin, product pages |
| Images on R2 | `MEDIA_BUCKET` binding, served with one-year immutable cache | preview: upload then download |
| Cron | Every 10 min: release abandoned checkout holds, delete expired sessions/verifications/rate-limit rows, carts older than 60 days | integration + preview |
| Deploy pipeline | GitHub Actions "Deploy": secret check, backup, migrations, create R2/Hyperdrive, build, Worker secrets, deploy, smoke test; "First super admin" | `.github/workflows/` |
| CI | Builds the Worker on every change and fails above 10 MiB | `.github/workflows/ci.yml` |

**BLOCKED (ACRONOS):**
- authorize Workers Paid (US$5/month)
- Cloudflare account and API token
- Neon account
- GitHub secrets
- authorization for the DNS change at Registro.br

See `docs/DEPLOY.md`.

## Phase 06 — Hardening

| Area | What exists | Proof |
| --- | --- | --- |
| Abuse limits | Checkout attempts 10 / 15 min per IP, add-to-cart 60 / 10 min, max 30 units per online order | code + integration |
| Sessions | `/account/security` lists where the account is signed in; sign out one or all other devices (immediate) | `tests/integration/hardening.test.ts` |
| Staff recovery | Super admin "Reset (lost phone)" for another person's two-factor; signs them out everywhere; audited | integration |
| Privacy (LGPD/GDPR/CCPA) | "Download my data" (JSON); "Delete my account" request; Admin → Privacy requests (15-day deadline) erases personal data, keeps orders for tax law | integration |
| Reports (`/admin/reports`) | Revenue per currency and day, orders, average, shipping, refunds, best sellers, countries; orders CSV for the accountant (audited, formula-safe) | integration |
| Accessibility | axe-core WCAG 2.2 AA on 10 public pages (desktop + mobile) and 11 admin screens: 0 violations; cyan text darkened for 4.5:1 | `tests/e2e/accessibility.spec.ts`, `docs/ACCESSIBILITY.md` |
| Performance | Lighthouse (production build, local): mobile perf 88–93, desktop 99–100, accessibility 100, CLS 0 on home, shop, product | run 2026-10-21 |
| Backups | Backup + restore drill scripts; drill OK | `docs/OPERATIONS.md` |
| CSP | Decision documented (nonces/hashes tested; compensating controls) | `docs/SECURITY.md` |

## Phase 05 — Cart, checkout and payments

All of this works in test mode. Selling for real needs the provider accounts and the shipping and tax decisions; see `docs/PAYMENTS.md`.

| Area | What exists | Proof |
| --- | --- | --- |
| Cart | Add to cart from the product page; cart in an HttpOnly cookie; header count; change quantity or remove; lines that sold out or changed are flagged | `tests/integration/checkout.test.ts` |
| Checkout | Contact, address, country (only active shipping zones), shipping method, payment method, terms; totals preview; server recomputes prices, shipping and currency (USD for USD zones, BRL for BRL zones); one order per idempotency key | integration + `tests/e2e/checkout.spec.ts` |
| Stock hold | Units reserved atomically when payment starts (never oversold, even with simultaneous buyers); released on expiry, cancel or provider failure; converted to a sale when paid | integration tests |
| Stripe | Hosted Checkout with Adaptive Pricing, idempotency keys, session expiry = stock hold; webhook signature verified on the raw body; events stored once; refunds | integration with real SDK + stripe-mock e2e |
| PayPal | Orders v2 REST: create, buyer approval, server capture, webhook verified by PayPal, refunds | integration (simulated HTTP) |
| Paid only when confirmed | Success page shows "Confirming payment" until the provider confirms; forged webhooks rejected (400); amount mismatch or late payment flagged "Needs attention" | integration + e2e |
| Admin orders | To ship / needs attention / awaiting payment / shipped / refunded / canceled; detail with items, payment, provider messages, address (shipping permission only); preparing → shipped with tracking → delivered; cancel unpaid; partial or full refund with optional restock | integration + browser check |
| Store settings | Legal entity, payment keys status and webhook addresses, enable methods, stock hold time, shipping zones and methods; store opens only when everything is ready | integration tests |

**BLOCKED:** Stripe/PayPal accounts (CNPJ), freight per country, DDP duty calculation, US sales tax / NF-e with the accountant, e-mail provider for order e-mails.

## Phase 04 (part 2) — Content and people

| Area | What exists | Proof |
| --- | --- | --- |
| Pages (`/admin/pages`) | About, Lab intro, Shipping, Returns, Privacy, Terms: title, intro, sections (add, reorder, remove), draft or publish, SEO, history with "load old version" | `tests/integration/content-admin.test.ts` |
| Policies | Publishing a policy requires confirming the text was reviewed by ACRONOS/lawyer; until published the site says it is being finalized | integration + e2e |
| Acronos Sci-Fi (`/admin/sci-fi`) | Story list, editor with formatting toolbar (headings, bold, italic, quote, lists, links, scene break), paste from Word/Google Docs keeps only that formatting, word count and reading time, cover, categories, draft / scheduled / published / archived, "imported from" provenance, SEO, history, delete; sanitized again on the server | integration + e2e |
| Acronos Lab (`/admin/lab`) | Projects (with an explicit stage: planned by default) and updates (optionally scheduled) | integration tests |
| Customers (`/admin/customers`) | Search, orders count, amount paid, newsletter status; detail with orders, addresses (only for roles allowed to see shipping data), messages; each view is audited | integration tests |
| Messages (`/admin/messages`) | Contact-form inbox: new / open / closed, reply by e-mail link | integration tests |
| Newsletter (`/admin/marketing`) | Subscribers with consent time and source, unsubscribe, CSV export (audited, protected against spreadsheet formula injection) | integration tests |
| Users (`/admin/users`, super admin) | Add a role to an existing account by e-mail, remove roles, two-factor status per person; the last super admin and your own super admin role are protected | integration tests |

## Phase 04 (part 1) — Catalog admin

| Area | What exists | Proof |
| --- | --- | --- |
| Products (`/admin/products`) | List with status tabs, search by name or SKU, price range, available stock, missing-price warnings | `tests/integration/catalog-admin.test.ts` |
| Product editor | Name, web address, description, composition, care, technical info; several photos at once (drag to reorder, cover, focal point, alt text, from library); sizes and colors generate variants; SKU suggestions; USD and BRL prices (typed as 189.00 or 990,00), compare-at prices; stock; weight; draft / published / archived; go-live date for drops; category (create inline) and collections; Google preview; "ready to sell" checklist; duplicate; delete (only if never sold) | integration + `tests/e2e/admin-catalog.spec.ts` |
| Rules enforced on the server | Cannot publish without a USD price; unique SKU and web address with readable errors; compare-at must be higher than price; two people editing the same product: the second save is refused instead of overwriting; stock saved as a difference so sales made meanwhile are not lost; variants that were sold are hidden, never deleted; every change audited | integration tests |
| Inventory (`/admin/inventory`) | All / low stock / sold out, search, add or remove units with a reason and note, per-variant history with who and when, low-stock alert level; stock can never go below units reserved by open orders | integration + e2e |
| Collections (`/admin/collections`) | Banner photo, text, products in chosen order (shop respects it), draft / published / archived, SEO, delete keeps products | integration tests |
| Categories (`/admin/products/categories`) | Add, rename, reorder, delete (products just lose the category) | integration tests |
| Permissions | Content editors see products read-only and cannot open inventory; managers and super admins edit | integration + e2e |

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

**Still PLANNED:** transactional e-mail (needs a provider). cart and checkout (Phase 05); confirmation e-mails (needs an e-mail provider); R2 image storage (Phase 07).

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
- CSP allows inline scripts (framework data streaming); see the decision in `docs/SECURITY.md`.
- `npm audit` reports moderate issues in `drizzle-kit`'s esbuild and high ones in `eslint-config-next`'s file globbing: development tools only, not part of the site that runs. CI blocks high issues in runtime dependencies.
- Lighthouse shows product meta descriptions as missing because Next.js streams metadata to browsers; search engine bots receive it in the page head.
- The database driver is `postgres-js`; the Cloudflare runtime driver (Neon serverless / Hyperdrive) is swapped in `db/client.ts` in Phase 07.
