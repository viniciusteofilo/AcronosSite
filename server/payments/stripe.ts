import Stripe from "stripe";
import type { CheckoutRequest, CheckoutSession, ConfirmedPayment, PaymentProvider, RefundResult } from "./types";
import { ProviderError } from "./types";

/**
 * Stripe Checkout (hosted page). Adaptive Pricing lets buyers outside the order currency pay
 * in their own currency; Stripe reports the amount in the order currency too, which is what
 * the order is checked against.
 */
export class StripeProvider implements PaymentProvider {
  readonly name = "stripe" as const;
  readonly environment: "sandbox" | "live";
  private client: Stripe;

  constructor(secretKey: string) {
    // STRIPE_API_BASE points the SDK at stripe-mock for automated tests. Only honoured with a
    // test key (sk_test_…), which cannot move real money.
    const local = secretKey.startsWith("sk_test_") && process.env.STRIPE_API_BASE ? new URL(process.env.STRIPE_API_BASE) : null;
    this.client = new Stripe(secretKey, {
      maxNetworkRetries: 2,
      timeout: 20_000,
      ...(local ? { host: local.hostname, port: Number(local.port), protocol: local.protocol.replace(":", "") as "http" | "https" } : {}),
    });
    this.environment = secretKey.startsWith("sk_live_") ? "live" : "sandbox";
  }

  async createCheckout(req: CheckoutRequest): Promise<CheckoutSession> {
    try {
      const session = await this.client.checkout.sessions.create(
        {
          mode: "payment",
          customer_email: req.email,
          client_reference_id: req.orderId,
          metadata: { order_id: req.orderId, order_number: req.orderNumber },
          payment_intent_data: { metadata: { order_id: req.orderId, order_number: req.orderNumber } },
          line_items: [
            ...req.items.map((i) => ({
              quantity: i.quantity,
              price_data: { currency: req.currency.toLowerCase(), unit_amount: i.unitAmountMinor, product_data: { name: i.name, description: i.description } },
            })),
            ...(req.shipping.amountMinor > 0
              ? [{ quantity: 1, price_data: { currency: req.currency.toLowerCase(), unit_amount: req.shipping.amountMinor, product_data: { name: `Shipping · ${req.shipping.name}` } } }]
              : []),
          ],
          adaptive_pricing: { enabled: true },
          expires_at: req.expiresAt,
          success_url: req.successUrl,
          cancel_url: req.cancelUrl,
        },
        { idempotencyKey: `checkout-${req.idempotencyKey}` },
      );
      if (!session.url) throw new ProviderError("Stripe did not return a checkout page.");
      return { providerCheckoutId: session.id, redirectUrl: session.url };
    } catch (e) {
      if (e instanceof ProviderError) throw e;
      throw new ProviderError(e instanceof Error ? `Stripe: ${e.message}` : "Stripe request failed");
    }
  }

  async refund(input: { providerPaymentId: string; amountMinor: number; currency: string; idempotencyKey: string; reason?: string }): Promise<RefundResult> {
    try {
      const r = await this.client.refunds.create(
        { payment_intent: input.providerPaymentId, amount: input.amountMinor, metadata: { reason: input.reason ?? "" } },
        { idempotencyKey: `refund-${input.idempotencyKey}` },
      );
      return { providerRefundId: r.id, status: r.status === "succeeded" ? "succeeded" : r.status === "failed" || r.status === "canceled" ? "failed" : "pending" };
    } catch (e) {
      throw new ProviderError(e instanceof Error ? `Stripe: ${e.message}` : "Stripe refund failed");
    }
  }
}

/** Verifies the Stripe-Signature header against the raw body. Throws if it does not match. */
export function verifyStripeEvent(rawBody: string, signature: string | null, secret: string): Stripe.Event {
  if (!signature) throw new ProviderError("Missing Stripe signature");
  return Stripe.webhooks.constructEvent(rawBody, signature, secret);
}

/** A completed Checkout Session, normalized. Uses the order-currency amounts when Adaptive Pricing converted. */
export function confirmedFromSession(session: Stripe.Checkout.Session): ConfirmedPayment | null {
  if (session.payment_status !== "paid") return null;
  const pi = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
  if (!pi || !session.currency || session.amount_total == null) return null;
  const conv = session.currency_conversion;
  return {
    providerCheckoutId: session.id,
    providerPaymentId: pi,
    orderCurrency: (conv?.source_currency ?? session.currency).toUpperCase(),
    orderAmountMinor: conv?.amount_total ?? session.amount_total,
    chargedCurrency: session.currency.toUpperCase(),
    chargedAmountMinor: session.amount_total,
  };
}
