# Payments and opening the store

The store stays closed for orders until **Admin → Settings** shows every item as ready.

## How a payment works

1. The cart becomes a pending order. Prices, shipping and totals are computed on the server.
2. Stock is held for 30 minutes (configurable, 30–120).
3. The buyer pays on Stripe's or PayPal's own page. Card data never reaches ACRONOS.
4. The order becomes **paid** only when a verified provider message arrives:
   - **Stripe:** a signed webhook.
   - **PayPal:** the server-side capture confirmed by PayPal, plus the webhook, which PayPal verifies.
5. Returning to the success page alone never marks an order paid.
6. Each provider message is stored once (unique event id), so a replayed message changes nothing.
7. Unpaid orders are closed and their stock released when the hold expires. A payment that arrives later is still recorded. If stock ran out in between, the order is flagged **Needs attention**.
8. Refunds go through the provider that took the payment, full or partial. Restocking is optional.

## Setup checklist (ACRONOS)

| Step | Where | Status |
| --- | --- | --- |
| Stripe Brasil business account on the CNPJ, verified | stripe.com | BLOCKED (ACRONOS) |
| PayPal Brasil business account on the CNPJ, verified | paypal.com | BLOCKED (ACRONOS) |
| Turn on **Adaptive Pricing** (buyers pay in their own currency) | Stripe Dashboard → Settings → Payments | after account approval |
| Add environment variables (`.env.example`) | hosting (Phase 07) | — |
| Stripe webhook `https://<site>/api/webhooks/stripe` with the events listed in Settings | Stripe Dashboard → Developers → Webhooks | — |
| PayPal webhook `https://<site>/api/webhooks/paypal` with the events listed in Settings | developer.paypal.com → your app → Webhooks | — |
| Legal entity, shipping zones and methods, enable payment methods, open the store | Admin → Settings | — |

Use test keys (`sk_test_…`, PayPal sandbox) first. Settings shows "test mode" while they are in use.

## Still to decide before selling (BLOCKED)

- **Freight prices per country.** Activate a country only after its costs are known.
- **Import duties.**
  - Only "paid by the recipient" (DDU) and domestic shipping are available.
  - Prepaid duties (DDP) need a duty calculation agreed with a customs broker.
- **Taxes.**
  - US sales tax, Brazilian invoices (NF-e) and their obligations must be confirmed with the accountant.
  - No tax is added to orders today.
- **E-mail provider.** Order confirmation and shipping e-mails start when one is connected. Until then, buyers keep the order link and staff see everything in Admin → Orders.

## Local testing

Automated tests run Stripe calls against **stripe-mock**, a local simulator of the Stripe API published by Stripe. It is used only with `sk_test_` keys and `STRIPE_API_BASE`.

PayPal is tested with a simulated HTTP layer. The real sandbox can be tried once keys exist.
