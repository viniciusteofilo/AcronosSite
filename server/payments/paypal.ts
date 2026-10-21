import type { CheckoutRequest, CheckoutSession, ConfirmedPayment, PaymentProvider, RefundResult } from "./types";
import { ProviderError } from "./types";

type Fetch = typeof fetch;

/** Currencies PayPal accepts with no decimals (amounts are sent as whole units). */
const ZERO_DECIMAL = new Set(["JPY", "HUF", "TWD"]);
const fmt = (minor: number, currency: string) => (ZERO_DECIMAL.has(currency) ? String(minor) : (minor / 100).toFixed(2));
const toMinor = (value: string, currency: string) => (ZERO_DECIMAL.has(currency) ? Number(value) : Math.round(Number(value) * 100));

/**
 * PayPal Checkout (Orders v2) through the REST API, no SDK. The buyer approves on PayPal,
 * comes back, and the server captures; webhooks confirm the capture as well.
 */
export class PayPalProvider implements PaymentProvider {
  readonly name = "paypal" as const;
  readonly environment: "sandbox" | "live";
  private base: string;
  private token: { value: string; expires: number } | null = null;

  constructor(
    private clientId: string,
    private clientSecret: string,
    env: "sandbox" | "live",
    private http: Fetch = fetch,
  ) {
    this.environment = env;
    this.base = env === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
  }

  private async accessToken(): Promise<string> {
    if (this.token && this.token.expires > Date.now() + 60_000) return this.token.value;
    const res = await this.http(`${this.base}/v1/oauth2/token`, {
      method: "POST",
      headers: { authorization: `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString("base64")}`, "content-type": "application/x-www-form-urlencoded" },
      body: "grant_type=client_credentials",
    });
    if (!res.ok) throw new ProviderError(`PayPal authentication failed (${res.status})`);
    const body = (await res.json()) as { access_token: string; expires_in: number };
    this.token = { value: body.access_token, expires: Date.now() + body.expires_in * 1000 };
    return body.access_token;
  }

  async api<T>(path: string, init: { method: string; body?: unknown; requestId?: string }): Promise<{ status: number; body: T }> {
    const res = await this.http(`${this.base}${path}`, {
      method: init.method,
      headers: {
        authorization: `Bearer ${await this.accessToken()}`,
        "content-type": "application/json",
        prefer: "return=representation",
        ...(init.requestId ? { "paypal-request-id": init.requestId } : {}),
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
    const body = (await res.json().catch(() => ({}))) as T;
    return { status: res.status, body };
  }

  async createCheckout(req: CheckoutRequest): Promise<CheckoutSession> {
    const c = req.currency;
    const itemTotal = req.items.reduce((s, i) => s + i.unitAmountMinor * i.quantity, 0);
    const { status, body } = await this.api<{ id?: string; links?: { rel: string; href: string }[]; message?: string }>("/v2/checkout/orders", {
      method: "POST",
      requestId: `checkout-${req.idempotencyKey}`,
      body: {
        intent: "CAPTURE",
        purchase_units: [
          {
            reference_id: req.orderId,
            custom_id: req.orderId,
            invoice_id: req.orderNumber,
            amount: {
              currency_code: c,
              value: fmt(req.totalMinor, c),
              breakdown: { item_total: { currency_code: c, value: fmt(itemTotal, c) }, shipping: { currency_code: c, value: fmt(req.shipping.amountMinor, c) } },
            },
            items: req.items.map((i) => ({ name: i.name.slice(0, 127), quantity: String(i.quantity), unit_amount: { currency_code: c, value: fmt(i.unitAmountMinor, c) } })),
          },
        ],
        payment_source: {
          paypal: {
            email_address: req.email,
            experience_context: { brand_name: "ACRONOS", user_action: "PAY_NOW", shipping_preference: "NO_SHIPPING", return_url: req.successUrl, cancel_url: req.cancelUrl },
          },
        },
      },
    });
    const approve = body.links?.find((l) => l.rel === "payer-action" || l.rel === "approve")?.href;
    if (status >= 300 || !body.id || !approve) throw new ProviderError(`PayPal could not start the payment (${status}).`);
    return { providerCheckoutId: body.id, redirectUrl: approve };
  }

  async capture(providerCheckoutId: string): Promise<ConfirmedPayment | null> {
    type Capture = { id: string; status: string; amount: { currency_code: string; value: string }; seller_receivable_breakdown?: { paypal_fee?: { value: string } } };
    type Order = { id: string; status: string; purchase_units?: { payments?: { captures?: Capture[] } }[]; details?: { issue: string }[] };
    let { status, body } = await this.api<Order>(`/v2/checkout/orders/${encodeURIComponent(providerCheckoutId)}/capture`, { method: "POST", requestId: `capture-${providerCheckoutId}`, body: {} });
    if (status === 422 && body.details?.some((d) => d.issue === "ORDER_ALREADY_CAPTURED")) {
      ({ status, body } = await this.api<Order>(`/v2/checkout/orders/${encodeURIComponent(providerCheckoutId)}`, { method: "GET" }));
    }
    if (status >= 300) return null;
    const cap = body.purchase_units?.[0]?.payments?.captures?.find((c) => c.status === "COMPLETED");
    if (!cap) return null;
    const cur = cap.amount.currency_code;
    const amount = toMinor(cap.amount.value, cur);
    const fee = cap.seller_receivable_breakdown?.paypal_fee?.value;
    return { providerCheckoutId: body.id, providerPaymentId: cap.id, orderCurrency: cur, orderAmountMinor: amount, chargedCurrency: cur, chargedAmountMinor: amount, feeMinor: fee ? toMinor(fee, cur) : null };
  }

  async refund(input: { providerPaymentId: string; amountMinor: number; currency: string; idempotencyKey: string; reason?: string }): Promise<RefundResult> {
    const { status, body } = await this.api<{ id?: string; status?: string }>(`/v2/payments/captures/${encodeURIComponent(input.providerPaymentId)}/refund`, {
      method: "POST",
      requestId: `refund-${input.idempotencyKey}`,
      body: { amount: { currency_code: input.currency, value: fmt(input.amountMinor, input.currency) }, note_to_payer: input.reason?.slice(0, 255) },
    });
    if (status >= 300 || !body.id) throw new ProviderError(`PayPal refund failed (${status}).`);
    return { providerRefundId: body.id, status: body.status === "COMPLETED" ? "succeeded" : body.status === "FAILED" || body.status === "CANCELLED" ? "failed" : "pending" };
  }

  /** Asks PayPal whether a webhook really came from PayPal (their documented verification call). */
  async verifyWebhook(headers: Headers, rawBody: string, webhookId: string): Promise<boolean> {
    const h = (k: string) => headers.get(k) ?? "";
    let event: unknown;
    try {
      event = JSON.parse(rawBody);
    } catch {
      return false;
    }
    const { status, body } = await this.api<{ verification_status?: string }>("/v1/notifications/verify-webhook-signature", {
      method: "POST",
      body: {
        auth_algo: h("paypal-auth-algo"),
        cert_url: h("paypal-cert-url"),
        transmission_id: h("paypal-transmission-id"),
        transmission_sig: h("paypal-transmission-sig"),
        transmission_time: h("paypal-transmission-time"),
        webhook_id: webhookId,
        webhook_event: event,
      },
    });
    return status === 200 && body.verification_status === "SUCCESS";
  }
}

export { toMinor as paypalToMinor };
