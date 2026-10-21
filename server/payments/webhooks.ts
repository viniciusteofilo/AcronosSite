import { and, eq, isNull } from "drizzle-orm";
import type Stripe from "stripe";
import type { Database } from "@/db/client";
import { orders, paymentEvents, refunds } from "@/db/schema";
import { cancelPendingOrder, markOrderPaid } from "@/server/orders/checkout";
import { paypalToMinor } from "./paypal";
import { confirmedFromSession } from "./stripe";
import type { ProviderName } from "./types";

/**
 * Stores the event once (unique provider + event id) and runs the handler only the first time.
 * A replayed or duplicated delivery is acknowledged and ignored.
 */
async function once(db: Database, provider: ProviderName, eventId: string, type: string, payload: unknown, handle: () => Promise<string>) {
  await db.insert(paymentEvents).values({ provider, providerEventId: eventId, type, payload: payload as object }).onConflictDoNothing();
  const [row] = await db
    .select()
    .from(paymentEvents)
    .where(and(eq(paymentEvents.provider, provider), eq(paymentEvents.providerEventId, eventId)))
    .limit(1);
  if (row?.processedAt) return "duplicate";
  const result = await handle();
  await db
    .update(paymentEvents)
    .set({ processedAt: new Date() })
    .where(and(eq(paymentEvents.id, row.id), isNull(paymentEvents.processedAt)));
  return result;
}

async function orderByCheckout(db: Database, providerCheckoutId: string) {
  const [o] = await db.select({ id: orders.id }).from(orders).where(eq(orders.providerCheckoutId, providerCheckoutId)).limit(1);
  return o ?? null;
}

async function updateRefund(db: Database, providerRefundId: string, status: "pending" | "succeeded" | "failed") {
  await db.update(refunds).set({ status, updatedAt: new Date() }).where(eq(refunds.providerRefundId, providerRefundId));
  return `refund ${status}`;
}

/** Handles a Stripe event whose signature was already verified. */
export async function handleStripeEvent(db: Database, event: Stripe.Event): Promise<string> {
  return once(db, "stripe", event.id, event.type, event, async () => {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const confirmed = confirmedFromSession(event.data.object);
        if (!confirmed) return "not paid yet";
        return markOrderPaid(db, "stripe", confirmed);
      }
      case "checkout.session.expired":
      case "checkout.session.async_payment_failed": {
        const o = await orderByCheckout(db, event.data.object.id);
        if (!o) return "unknown_order";
        await cancelPendingOrder(db, o.id, event.type === "checkout.session.expired" ? "Stripe checkout expired" : "Payment failed");
        return "canceled";
      }
      case "refund.updated":
      case "refund.created": {
        const r = event.data.object;
        return updateRefund(db, r.id, r.status === "succeeded" ? "succeeded" : r.status === "failed" || r.status === "canceled" ? "failed" : "pending");
      }
      default:
        return "ignored";
    }
  });
}

type PayPalEvent = {
  id: string;
  event_type: string;
  resource: {
    id: string;
    status?: string;
    amount?: { currency_code: string; value: string };
    supplementary_data?: { related_ids?: { order_id?: string } };
  };
};

/** Handles a PayPal event whose authenticity was already confirmed with PayPal. */
export async function handlePayPalEvent(db: Database, event: PayPalEvent): Promise<string> {
  return once(db, "paypal", event.id, event.event_type, event, async () => {
    const r = event.resource;
    const orderId = r.supplementary_data?.related_ids?.order_id;
    switch (event.event_type) {
      case "PAYMENT.CAPTURE.COMPLETED": {
        if (!orderId || !r.amount) return "missing order";
        const amount = paypalToMinor(r.amount.value, r.amount.currency_code);
        return markOrderPaid(db, "paypal", {
          providerCheckoutId: orderId,
          providerPaymentId: r.id,
          orderCurrency: r.amount.currency_code,
          orderAmountMinor: amount,
          chargedCurrency: r.amount.currency_code,
          chargedAmountMinor: amount,
        });
      }
      case "PAYMENT.CAPTURE.DENIED":
      case "PAYMENT.CAPTURE.DECLINED": {
        if (!orderId) return "missing order";
        const o = await orderByCheckout(db, orderId);
        if (!o) return "unknown_order";
        await cancelPendingOrder(db, o.id, "PayPal payment declined");
        return "canceled";
      }
      case "PAYMENT.CAPTURE.REFUNDED":
      case "PAYMENT.REFUND.COMPLETED":
        return updateRefund(db, r.id, "succeeded");
      case "PAYMENT.REFUND.FAILED":
        return updateRefund(db, r.id, "failed");
      default:
        return "ignored";
    }
  });
}
