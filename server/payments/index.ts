import { PayPalProvider } from "./paypal";
import { StripeProvider } from "./stripe";
import type { PaymentProvider, ProviderName } from "./types";

/** Which providers have credentials in the environment (keys are never stored in the database). */
export function paymentEnvStatus() {
  const stripeKey = process.env.STRIPE_SECRET_KEY ?? "";
  const paypalEnv: "sandbox" | "live" = process.env.PAYPAL_ENV === "live" ? "live" : "sandbox";
  return {
    stripe: {
      configured: Boolean(stripeKey && process.env.STRIPE_WEBHOOK_SECRET),
      environment: stripeKey.startsWith("sk_live_") ? ("live" as const) : ("sandbox" as const),
      missing: [!stripeKey && "STRIPE_SECRET_KEY", !process.env.STRIPE_WEBHOOK_SECRET && "STRIPE_WEBHOOK_SECRET"].filter(Boolean) as string[],
    },
    paypal: {
      configured: Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET && process.env.PAYPAL_WEBHOOK_ID),
      environment: paypalEnv,
      missing: [!process.env.PAYPAL_CLIENT_ID && "PAYPAL_CLIENT_ID", !process.env.PAYPAL_CLIENT_SECRET && "PAYPAL_CLIENT_SECRET", !process.env.PAYPAL_WEBHOOK_ID && "PAYPAL_WEBHOOK_ID"].filter(Boolean) as string[],
    },
  };
}

export type Providers = Partial<Record<ProviderName, PaymentProvider>>;

let cached: Providers | null = null;

/** Providers built from environment variables. Tests pass their own instead. */
export function getPaymentProviders(): Providers {
  if (cached) return cached;
  const env = paymentEnvStatus();
  cached = {
    ...(env.stripe.configured ? { stripe: new StripeProvider(process.env.STRIPE_SECRET_KEY!) } : {}),
    ...(env.paypal.configured ? { paypal: new PayPalProvider(process.env.PAYPAL_CLIENT_ID!, process.env.PAYPAL_CLIENT_SECRET!, env.paypal.environment) } : {}),
  };
  return cached;
}
