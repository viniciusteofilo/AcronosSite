import { formatMoney } from "@/lib/money";
import { siteUrl } from "@/lib/site-url";

/**
 * Plain, brand-consistent e-mails: light gray, black type, one button. Every value from a person
 * or the database is escaped. Copy only states facts the system knows (no invented promises).
 */
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

type Block = { p: string } | { button: { label: string; url: string } } | { rows: [string, string][] } | { small: string };

function layout(title: string, blocks: Block[]): { html: string; text: string } {
  const body = blocks
    .map((b) => {
      if ("p" in b) return `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#111">${esc(b.p)}</p>`;
      if ("small" in b) return `<p style="margin:16px 0 0;font-size:12px;line-height:1.6;color:#5a5a57">${esc(b.small)}</p>`;
      if ("button" in b)
        return `<p style="margin:24px 0"><a href="${esc(b.button.url)}" style="display:inline-block;background:#111;color:#ecece9;padding:14px 22px;font-family:monospace;font-size:12px;letter-spacing:.16em;text-transform:uppercase;text-decoration:none">${esc(b.button.label)}</a></p>`;
      return `<table role="presentation" style="width:100%;border-collapse:collapse;margin:8px 0 16px">${b.rows
        .map(([k, v]) => `<tr><td style="padding:8px 0;border-bottom:1px solid #cfcfcb;font-size:14px;color:#111">${esc(k)}</td><td style="padding:8px 0;border-bottom:1px solid #cfcfcb;font-size:14px;color:#111;text-align:right">${esc(v)}</td></tr>`)
        .join("")}</table>`;
    })
    .join("");
  const html = `<!doctype html><html><body style="margin:0;background:#ecece9;font-family:Helvetica,Arial,sans-serif">
<table role="presentation" style="width:100%;background:#ecece9"><tr><td style="padding:32px 16px">
<table role="presentation" style="max-width:560px;margin:0 auto;background:#f7f7f5;border:1px solid #cfcfcb"><tr><td style="padding:32px">
<p style="margin:0 0 28px;font-family:monospace;font-size:13px;letter-spacing:.32em;color:#111">ACRONOS</p>
<h1 style="margin:0 0 20px;font-size:20px;font-weight:600;color:#111">${esc(title)}</h1>
${body}
</td></tr></table>
<p style="max-width:560px;margin:16px auto 0;font-family:monospace;font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:#5a5a57">ACRONOS · São Paulo · Future observed from everyday chaos</p>
</td></tr></table></body></html>`;
  const text = [
    "ACRONOS",
    "",
    title,
    "",
    ...blocks.map((b) => ("p" in b ? b.p : "small" in b ? b.small : "button" in b ? `${b.button.label}: ${b.button.url}` : b.rows.map(([k, v]) => `${k}: ${v}`).join("\n"))),
  ].join("\n");
  return { html, text };
}

export function verifyEmailMessage(name: string, url: string) {
  return { subject: "Confirm your e-mail", ...layout("Confirm your e-mail", [{ p: `Hello ${name},` }, { p: "Confirm this address to finish setting up your ACRONOS account." }, { button: { label: "Confirm e-mail", url } }, { small: "If you did not create an account, ignore this message." }]) };
}

export function resetPasswordMessage(name: string, url: string) {
  return {
    subject: "Reset your password",
    ...layout("Reset your password", [
      { p: `Hello ${name},` },
      { p: "Someone asked to reset the password of your ACRONOS account. The link works for one hour." },
      { button: { label: "Choose a new password", url } },
      { small: "If it was not you, ignore this message: your password stays the same." },
    ]),
  };
}

export function passwordChangedMessage(name: string) {
  return {
    subject: "Your password was changed",
    ...layout("Your password was changed", [
      { p: `Hello ${name},` },
      { p: "The password of your ACRONOS account was just changed, and other devices were signed out." },
      { small: "If it was not you, reset your password now and contact us." },
      { button: { label: "Reset password", url: `${siteUrl()}/login/forgot` } },
    ]),
  };
}

type OrderForEmail = {
  number: string;
  currency: string;
  subtotalMinor: number;
  shippingMinor: number;
  discountMinor: number;
  taxMinor: number;
  dutiesMinor: number;
  totalMinor: number;
  items: { productName: string; variantName?: string | null; quantity: number; unitPriceMinor: number }[];
};

const money = (o: { currency: string }, v: number) => formatMoney(v, o.currency);

export function orderConfirmationMessage(o: OrderForEmail, statusUrl: string) {
  const rows: [string, string][] = o.items.map((i) => [`${i.quantity} × ${i.productName}${i.variantName ? ` (${i.variantName})` : ""}`, money(o, i.unitPriceMinor * i.quantity)]);
  rows.push(["Subtotal", money(o, o.subtotalMinor)]);
  if (o.discountMinor) rows.push(["Discount", `−${money(o, o.discountMinor)}`]);
  rows.push(["Shipping", money(o, o.shippingMinor)]);
  if (o.taxMinor) rows.push(["Tax", money(o, o.taxMinor)]);
  if (o.dutiesMinor) rows.push(["Import duties", money(o, o.dutiesMinor)]);
  rows.push(["Total", money(o, o.totalMinor)]);
  return {
    subject: `Order ${o.number} confirmed`,
    ...layout(`Order ${o.number} confirmed`, [
      { p: "Thank you. Your payment was confirmed and the order is now being prepared." },
      { rows },
      { p: "We will e-mail you again with the tracking number when it ships." },
      { button: { label: "See order status", url: statusUrl } },
    ]),
  };
}

export function orderShippedMessage(o: { number: string }, s: { carrier: string | null; trackingNumber: string | null; trackingUrl: string | null }, statusUrl: string) {
  const rows: [string, string][] = [];
  if (s.carrier) rows.push(["Carrier", s.carrier]);
  if (s.trackingNumber) rows.push(["Tracking number", s.trackingNumber]);
  return {
    subject: `Order ${o.number} shipped`,
    ...layout(`Order ${o.number} shipped`, [
      { p: "Your order is on its way." },
      ...(rows.length ? [{ rows }] : []),
      { button: s.trackingUrl ? { label: "Track package", url: s.trackingUrl } : { label: "See order status", url: statusUrl } },
    ]),
  };
}

export function orderRefundedMessage(o: { number: string; currency: string }, amountMinor: number, full: boolean, statusUrl: string) {
  return {
    subject: `Refund for order ${o.number}`,
    ...layout(`Refund for order ${o.number}`, [
      { p: `${full ? "Your order was refunded" : "Part of your order was refunded"}: ${money(o, amountMinor)}.` },
      { p: "The amount goes back to the payment method you used. Banks and card issuers usually take 5 to 10 business days to show it." },
      { button: { label: "See order status", url: statusUrl } },
    ]),
  };
}

export function newsletterConfirmMessage(confirmUrl: string) {
  return {
    subject: "Confirm your subscription",
    ...layout("Confirm your subscription", [
      { p: "You asked to receive ACRONOS news by e-mail. Confirm to start receiving it." },
      { button: { label: "Confirm subscription", url: confirmUrl } },
      { small: "If it was not you, ignore this message: you will not be subscribed." },
    ]),
  };
}

export function contactNotificationMessage(m: { name: string; email: string; topic: string; message: string }) {
  return {
    subject: `New message (${m.topic}) from ${m.name}`,
    ...layout("New message from the site", [
      { rows: [["From", `${m.name} <${m.email}>`], ["Topic", m.topic]] },
      { p: m.message },
      { button: { label: "Open messages", url: `${siteUrl()}/admin/messages` } },
      { small: "Replying to this e-mail answers the person directly." },
    ]),
  };
}

export function staffSignInMessage(name: string, device: string, ip: string | null, when: Date) {
  return {
    subject: "New sign-in to the ACRONOS admin",
    ...layout("New sign-in to your staff account", [
      { p: `Hello ${name},` },
      { rows: [["When", when.toUTCString()], ["Device", device], ["IP address", ip || "unknown"]] },
      { p: "If it was you, nothing to do. If not, sign out of all other devices and change your password now." },
      { button: { label: "Review sessions", url: `${siteUrl()}/account/security` } },
    ]),
  };
}

export function layoutTest() {
  return { subject: "ACRONOS test e-mail", ...layout("Test e-mail", [{ p: "If you can read this, the store can send e-mails." }]) };
}
