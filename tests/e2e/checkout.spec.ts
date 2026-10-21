import { expect, test } from "@playwright/test";
import postgres from "postgres";
import Stripe from "stripe";

/**
 * Full purchase against stripe-mock: add to cart, checkout, provider redirect, return page
 * (still pending), signed webhook, paid. The store is closed again afterwards.
 */
const sqlClient = () => {
  const url = process.env.TEST_DATABASE_URL;
  if (!url || !new URL(url).pathname.includes("test")) throw new Error("TEST_DATABASE_URL must point at a test database");
  return postgres(url, { max: 1 });
};
const T = Date.now().toString(36);

test.beforeAll(async () => {
  const ok = await fetch("http://localhost:12111/v1/balance", { headers: { authorization: "Bearer sk_test_e2e" } }).then((r) => r.ok).catch(() => false);
  test.skip(!ok, "stripe-mock is not running");
  const sql = sqlClient();
  await sql`DELETE FROM rate_limits`;
  const [m] = await sql`INSERT INTO merchant_entities (legal_name, country, settlement_currency, is_active) VALUES ('E2E entity', 'BR', 'BRL', true) RETURNING id`;
  const [z] = await sql`INSERT INTO shipping_zones (name, countries, is_enabled) VALUES (${`E2E ${T}`}, ARRAY['US']::char(2)[], true) RETURNING id`;
  await sql`INSERT INTO shipping_methods (zone_id, name, currency, price_minor, duties_model, is_active) VALUES (${z.id}, 'Standard', 'USD', 1500, 'ddu', true)`;
  await sql`INSERT INTO settings (key, value) VALUES ('store', ${sql.json({ checkoutOpen: true, merchantEntityId: m.id, stripeEnabled: true, paypalEnabled: false, reservationMinutes: 30 })})
            ON CONFLICT (key) DO UPDATE SET value = excluded.value`;
  const [p] = await sql`INSERT INTO products (slug, name, status, published_at) VALUES (${`e2e-tee-${T}`}, ${`E2E Tee ${T}`}, 'published', now() - interval '1 day') RETURNING id`;
  const [v] = await sql`INSERT INTO product_variants (product_id, sku, size) VALUES (${p.id}, ${`E2E-${T}-M`}, 'M') RETURNING id`;
  await sql`INSERT INTO variant_prices (variant_id, currency, amount_minor) VALUES (${v.id}, 'USD', 4000)`;
  await sql`INSERT INTO inventory_levels (variant_id, on_hand) VALUES (${v.id}, 2)`;
  await sql.end();
});

test.afterAll(async () => {
  const sql = sqlClient();
  await sql`UPDATE settings SET value = jsonb_set(value, '{checkoutOpen}', 'false') WHERE key = 'store'`;
  await sql`UPDATE shipping_zones SET is_enabled = false WHERE name = ${`E2E ${T}`}`;
  await sql.end();
});

test("a buyer pays and the order is confirmed only by the signed webhook", async ({ page, isMobile }) => {
  test.skip(!!isMobile, "one run is enough");
  await page.goto(`/products/e2e-tee-${T}`);
  await page.getByRole("radio", { name: "M", exact: true }).check({ force: true });
  await expect(async () => {
    await page.getByRole("button", { name: "Add to cart" }).click();
    await expect(page.getByText("Added to your cart.")).toBeVisible({ timeout: 2000 });
  }).toPass();
  await expect(page.getByRole("link", { name: "Cart, 1 item" })).toBeVisible();
  await page.goto("/checkout");
  await page.getByLabel("Email").fill("e2e@example.test");
  await page.getByLabel("Full name").fill("E2E Buyer");
  await page.getByLabel("Address", { exact: true }).fill("1 Test St");
  await page.getByLabel("City").fill("Orlando");
  await page.getByLabel("Postal code").fill("32801");
  await expect(page.getByText("$55.00")).toBeVisible(); // 40 + 15 shipping
  await page.route("https://checkout.stripe.com/**", (r) => r.fulfill({ status: 200, contentType: "text/html", body: "<h1>stand-in</h1>" }));
  await page.getByRole("button", { name: "Continue to payment" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "accept the terms" })).toBeVisible();
  await page.getByRole("checkbox", { name: /I accept/ }).check();
  await page.getByRole("button", { name: "Continue to payment" }).click();
  await page.waitForURL("https://checkout.stripe.com/**");

  const sql = sqlClient();
  const [o] = await sql`SELECT id, public_token, provider_checkout_id, total_minor FROM orders WHERE email = 'e2e@example.test' ORDER BY created_at DESC LIMIT 1`;
  expect(o.total_minor).toBe(5500);
  await page.goto(`/checkout/complete?order=${o.id}&t=${o.public_token}`);
  await expect(page.getByRole("heading", { name: "Confirming payment" })).toBeVisible();

  const payload = JSON.stringify({
    id: `evt_e2e_${T}`,
    object: "event",
    type: "checkout.session.completed",
    data: { object: { id: o.provider_checkout_id, object: "checkout.session", payment_status: "paid", payment_intent: `pi_e2e_${T}`, currency: "usd", amount_total: 5500 } },
  });
  const forged = await page.request.post("/api/webhooks/stripe", { data: payload, headers: { "stripe-signature": "t=1,v1=00" } });
  expect(forged.status()).toBe(400);
  const res = await page.request.post("/api/webhooks/stripe", {
    data: payload,
    headers: { "stripe-signature": Stripe.webhooks.generateTestHeaderString({ payload, secret: "whsec_e2e_secret" }), "content-type": "application/json" },
  });
  expect(res.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "Thank you" })).toBeVisible({ timeout: 15_000 });
  const [lvl] = await sql`SELECT il.on_hand, il.reserved FROM inventory_levels il JOIN product_variants v ON v.id = il.variant_id WHERE v.sku = ${`E2E-${T}-M`}`;
  expect(lvl).toMatchObject({ on_hand: 1, reserved: 0 });
  await sql.end();
});
