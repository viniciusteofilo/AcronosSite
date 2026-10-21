import { getDb } from "@/db/client";
import { verifyStripeEvent } from "@/server/payments/stripe";
import { handleStripeEvent } from "@/server/payments/webhooks";

/** Stripe webhook. The signature is checked against the raw body before anything is read. */
export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return Response.json({ error: "Not configured" }, { status: 503 });
  const raw = await request.text();
  let event;
  try {
    event = verifyStripeEvent(raw, request.headers.get("stripe-signature"), secret);
  } catch {
    return Response.json({ error: "Invalid signature" }, { status: 400 });
  }
  try {
    const result = await handleStripeEvent(getDb(), event);
    return Response.json({ received: true, result });
  } catch (e) {
    console.error("[stripe webhook]", event.type, e);
    return Response.json({ error: "Processing failed" }, { status: 500 }); // Stripe retries
  }
}
