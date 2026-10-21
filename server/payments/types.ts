/**
 * What the order code needs from a payment provider. Stripe and PayPal implement it; tests use
 * an in-memory fake. Hosted checkout only: card data never touches ACRONOS servers.
 */
export type ProviderName = "stripe" | "paypal";

export type CheckoutRequest = {
  orderId: string;
  orderNumber: string;
  email: string;
  currency: string;
  items: { name: string; description?: string; unitAmountMinor: number; quantity: number }[];
  shipping: { name: string; amountMinor: number };
  totalMinor: number;
  successUrl: string;
  cancelUrl: string;
  /** Unix seconds; the provider should stop accepting payment after this. */
  expiresAt: number;
  idempotencyKey: string;
};

export type CheckoutSession = { providerCheckoutId: string; redirectUrl: string };

/** A payment confirmed by the provider, normalized to the order's currency. */
export type ConfirmedPayment = {
  providerCheckoutId: string;
  providerPaymentId: string;
  orderCurrency: string;
  orderAmountMinor: number;
  chargedCurrency: string;
  chargedAmountMinor: number;
  feeMinor?: number | null;
};

export type RefundResult = { providerRefundId: string; status: "pending" | "succeeded" | "failed" };

export interface PaymentProvider {
  readonly name: ProviderName;
  readonly environment: "sandbox" | "live";
  createCheckout(req: CheckoutRequest): Promise<CheckoutSession>;
  /** PayPal only: capture after the buyer approves. Stripe captures inside its checkout. */
  capture?(providerCheckoutId: string): Promise<ConfirmedPayment | null>;
  refund(input: { providerPaymentId: string; amountMinor: number; currency: string; idempotencyKey: string; reason?: string }): Promise<RefundResult>;
}

export class ProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProviderError";
  }
}
