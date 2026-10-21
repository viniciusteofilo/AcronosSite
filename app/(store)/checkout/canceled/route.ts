import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/db/client";
import { addToCart, CART_COOKIE } from "@/server/cart/cart";
import { cancelPendingOrder, getOrderForBuyer, itemsOfOrder } from "@/server/orders/checkout";

/** The buyer left the payment page: free the stock and put the items back in the cart. */
export async function GET(request: NextRequest) {
  const db = getDb();
  const order = await getOrderForBuyer(db, request.nextUrl.searchParams.get("order") ?? "", request.nextUrl.searchParams.get("t") ?? "");
  const back = new URL("/cart", request.nextUrl);
  if (!order) return NextResponse.redirect(back);
  if (order.paymentStatus !== "pending") {
    return NextResponse.redirect(new URL(`/checkout/complete?order=${order.id}&t=${order.publicToken}`, request.nextUrl));
  }
  await cancelPendingOrder(db, order.id, "Buyer left the payment page");
  const jar = await cookies();
  let cartId = jar.get(CART_COOKIE)?.value ?? null;
  for (const it of await itemsOfOrder(db, [order.id])) {
    if (!it.variantId) continue;
    try {
      cartId = await addToCart(db, cartId, { variantId: it.variantId, quantity: it.quantity }, order.userId);
    } catch {
      // sold out meanwhile: the cart simply does not get it back
    }
  }
  back.searchParams.set("canceled", "1");
  const res = NextResponse.redirect(back);
  if (cartId) res.cookies.set(CART_COOKIE, cartId, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 30 });
  return res;
}
