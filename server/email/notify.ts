import { createHmac, timingSafeEqual } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import type { Database } from "@/db/client";
import { newsletterSubscribers, orderItems, orders, shipments } from "@/db/schema";
import { siteUrl } from "@/lib/site-url";
import { getStoreSettings } from "@/server/store/settings";
import { sendEmail } from "./send";
import { contactNotificationMessage, newsletterConfirmMessage, orderConfirmationMessage, orderRefundedMessage, orderShippedMessage } from "./templates";

/** Link to the buyer's order status page (works for guests: secret token from checkout). */
export const orderStatusUrl = (o: { id: string; publicToken: string | null }) => `${siteUrl()}/checkout/complete?order=${o.id}&t=${o.publicToken ?? ""}`;

async function loadOrder(db: Database, orderId: string) {
  const [o] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  return o ?? null;
}

export async function notifyOrderPaid(db: Database, orderId: string) {
  const o = await loadOrder(db, orderId);
  if (!o) return;
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, o.id));
  const m = orderConfirmationMessage(
    { ...o, items: items.map((i) => ({ ...i, variantName: [i.color, i.size].filter(Boolean).join(" / ") || null })) },
    orderStatusUrl(o),
  );
  await sendEmail(db, { kind: "order_confirmation", to: o.email, ref: o.id, ...m });
}

export async function notifyOrderShipped(db: Database, orderId: string) {
  const o = await loadOrder(db, orderId);
  if (!o) return;
  const [s] = await db.select().from(shipments).where(eq(shipments.orderId, o.id)).orderBy(desc(shipments.createdAt)).limit(1);
  if (!s) return;
  await sendEmail(db, { kind: "order_shipped", to: o.email, ref: o.id, ...orderShippedMessage(o, s, orderStatusUrl(o)) });
}

export async function notifyOrderRefunded(db: Database, orderId: string, amountMinor: number, full: boolean) {
  const o = await loadOrder(db, orderId);
  if (!o) return;
  await sendEmail(db, { kind: "order_refunded", to: o.email, ref: o.id, ...orderRefundedMessage(o, amountMinor, full, orderStatusUrl(o)) });
}

export async function notifyContact(db: Database, m: { name: string; email: string; topic: string; message: string; id: string }) {
  const { notifyEmail } = await getStoreSettings(db);
  if (!notifyEmail) return;
  await sendEmail(db, { kind: "contact_notification", to: notifyEmail, replyTo: m.email, ref: m.id, ...contactNotificationMessage(m) });
}

// ── newsletter double opt-in: signed links, nothing extra stored ─────────────────────────────

const secret = () => {
  const s = process.env.BETTER_AUTH_SECRET;
  if (!s) throw new Error("BETTER_AUTH_SECRET is not set");
  return s;
};
const b64 = (s: string) => Buffer.from(s).toString("base64url");
const sign = (payload: string) => createHmac("sha256", secret()).update(`newsletter:${payload}`).digest("base64url");

/** Token = e-mail + purpose + expiry, signed with the server secret. */
export function newsletterToken(email: string, purpose: "confirm" | "unsubscribe", now = Date.now()): string {
  const exp = purpose === "confirm" ? now + 7 * 86_400_000 : 0; // unsubscribe links never expire
  const payload = `${b64(email.toLowerCase())}.${purpose}.${exp}`;
  return `${payload}.${sign(payload)}`;
}

export function readNewsletterToken(token: string, purpose: "confirm" | "unsubscribe", now = Date.now()): string | null {
  const parts = token.split(".");
  if (parts.length !== 4 || parts[1] !== purpose) return null;
  const payload = parts.slice(0, 3).join(".");
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(parts[3]);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  const exp = Number(parts[2]);
  if (exp && exp < now) return null;
  try {
    return Buffer.from(parts[0], "base64url").toString();
  } catch {
    return null;
  }
}

export async function sendNewsletterConfirmation(db: Database, email: string) {
  const url = `${siteUrl()}/newsletter/confirm?t=${encodeURIComponent(newsletterToken(email, "confirm"))}`;
  await sendEmail(db, { kind: "newsletter_confirm", to: email, ...newsletterConfirmMessage(url) });
}

/** Confirms or cancels a subscription from a signed link. Returns what happened, for the page. */
export async function applyNewsletterLink(db: Database, token: string, purpose: "confirm" | "unsubscribe"): Promise<"done" | "invalid"> {
  const email = readNewsletterToken(token, purpose);
  if (!email) return "invalid";
  const now = new Date();
  const [row] = await db
    .update(newsletterSubscribers)
    .set(purpose === "confirm" ? { status: "confirmed", consentAt: now, updatedAt: now } : { status: "unsubscribed", unsubscribedAt: now, updatedAt: now })
    .where(eq(newsletterSubscribers.email, email))
    .returning({ id: newsletterSubscribers.id });
  return row || purpose === "unsubscribe" ? "done" : "invalid";
}
