import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/db/client";
import { getOrderForBuyer, markOrderPaid } from "@/server/orders/checkout";
import { getPaymentProviders } from "@/server/payments";

/**
 * PayPal sends the buyer back here after approval. The server captures the payment with
 * PayPal directly; the order is marked paid only if PayPal confirms the capture.
 */
export async function GET(request: NextRequest) {
  const orderId = request.nextUrl.searchParams.get("order") ?? "";
  const token = request.nextUrl.searchParams.get("t") ?? "";
  const done = new URL(`/checkout/complete?order=${encodeURIComponent(orderId)}&t=${encodeURIComponent(token)}`, request.nextUrl);
  const db = getDb();
  const order = await getOrderForBuyer(db, orderId, token);
  if (!order || order.paymentProvider !== "paypal" || !order.providerCheckoutId) return NextResponse.redirect(new URL("/cart", request.nextUrl));
  if (order.paymentStatus === "pending") {
    const paypal = getPaymentProviders().paypal;
    try {
      const confirmed = await paypal?.capture?.(order.providerCheckoutId);
      if (confirmed) await markOrderPaid(db, "paypal", confirmed);
    } catch (e) {
      console.error("[paypal return]", e); // the webhook still confirms the payment if it went through
    }
  }
  return NextResponse.redirect(done);
}
