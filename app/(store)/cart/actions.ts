"use server";

import { refresh } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import { UserError } from "@/server/admin/errors";
import { getAccessContext } from "@/server/auth";
import { addToCart, CART_COOKIE, setCartQuantity } from "@/server/cart/cart";
import { startCheckout } from "@/server/orders/checkout";
import { getPaymentProviders } from "@/server/payments";
import { takeRateLimit } from "@/server/security/rate-limit";
import { clientIp, hashIp } from "@/server/security/request";
import { getCheckoutReadiness } from "@/server/store/settings";

export type CartResult = { ok: boolean; message: string; field?: string; values?: Record<string, string> } | null;

async function cartCookie(id: string) {
  (await cookies()).set(CART_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function addToCartAction(_prev: CartResult, form: FormData): Promise<CartResult> {
  const db = getDb();
  if (!(await getCheckoutReadiness(db)).open) return { ok: false, message: "Online orders are not open yet." };
  if (!(await takeRateLimit(db, `cart:${hashIp(await clientIp())}`, 60, 600))) return { ok: false, message: "Too many attempts. Try again in a few minutes." };
  try {
    const jar = await cookies();
    const ctx = await getAccessContext();
    const id = await addToCart(db, jar.get(CART_COOKIE)?.value, { variantId: form.get("variantId"), quantity: form.get("quantity") ?? 1 }, ctx?.userId ?? null);
    await cartCookie(id);
    refresh();
    return { ok: true, message: "Added to your cart." };
  } catch (e) {
    return { ok: false, message: e instanceof UserError ? e.message : "Could not add this item. Try again." };
  }
}

export async function updateCartAction(form: FormData) {
  const jar = await cookies();
  try {
    await setCartQuantity(getDb(), jar.get(CART_COOKIE)?.value, { variantId: form.get("variantId"), quantity: form.get("quantity") });
  } catch {
    // the cart page shows the current availability next to each line
  }
  refresh();
}

/** Starts the hosted checkout and sends the buyer to Stripe or PayPal. */
export async function checkoutAction(_prev: CartResult, form: FormData): Promise<CartResult> {
  const db = getDb();
  const jar = await cookies();
  const ctx = await getAccessContext();
  const str = (k: string) => String(form.get(k) ?? "");
  const values = Object.fromEntries(["email", "fullName", "line1", "line2", "city", "region", "postalCode", "country", "phone", "methodId", "provider"].map((k) => [k, str(k)]));
  // Each attempt holds stock for a while: limit attempts so nobody can lock the stock.
  if (!(await takeRateLimit(db, `checkout:${hashIp(await clientIp())}`, 10, 900))) {
    return { ok: false, message: "Too many checkout attempts. Wait a few minutes and try again.", values };
  }
  let url: string;
  try {
    const r = await startCheckout(
      db,
      {
        email: values.email,
        address: { fullName: values.fullName, line1: values.line1, line2: values.line2, city: values.city, region: values.region, postalCode: values.postalCode, country: values.country, phone: values.phone },
        methodId: values.methodId,
        provider: values.provider,
        idempotencyKey: str("idempotencyKey"),
        acceptTerms: form.get("acceptTerms") === "on",
      },
      { cartId: jar.get(CART_COOKIE)?.value, userId: ctx?.userId ?? null, providers: getPaymentProviders(), siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000" },
    );
    url = r.redirectUrl;
  } catch (e) {
    if (e instanceof UserError) return { ok: false, message: e.message, field: e.field, values };
    if (e instanceof Error && e.name === "ZodError" && "issues" in e && Array.isArray(e.issues)) {
      const issue = e.issues[0] as { path: (string | number)[]; message: string };
      return { ok: false, message: issue.message, field: String(issue.path.at(-1)), values };
    }
    console.error("[checkout]", e);
    return { ok: false, message: "Something went wrong. Nothing was charged. Please try again.", values };
  }
  redirect(url);
}
