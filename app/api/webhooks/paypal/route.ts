import { getDb } from "@/db/client";
import { getPaymentProviders } from "@/server/payments";
import type { PayPalProvider } from "@/server/payments/paypal";
import { handlePayPalEvent } from "@/server/payments/webhooks";

/** PayPal webhook. PayPal itself confirms each message is genuine before it is processed. */
export async function POST(request: Request) {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  const paypal = getPaymentProviders().paypal as PayPalProvider | undefined;
  if (!webhookId || !paypal) return Response.json({ error: "Not configured" }, { status: 503 });
  const raw = await request.text();
  if (raw.length > 1_000_000 || !(await paypal.verifyWebhook(request.headers, raw, webhookId))) {
    return Response.json({ error: "Invalid signature" }, { status: 400 });
  }
  try {
    const result = await handlePayPalEvent(getDb(), JSON.parse(raw));
    return Response.json({ received: true, result });
  } catch (e) {
    console.error("[paypal webhook]", e);
    return Response.json({ error: "Processing failed" }, { status: 500 });
  }
}
