import { connection } from "next/server";
import { cookies } from "next/headers";
import { getDb } from "@/db/client";
import { CART_COOKIE, getCart } from "@/server/cart/cart";
import { SiteHeaderAuto } from "./site-header";

/** Header with the live number of items in the visitor's cart (read from the cart cookie). */
export async function HeaderWithCart() {
  await connection();
  const id = (await cookies()).get(CART_COOKIE)?.value;
  const cart = id ? await getCart(getDb(), id) : null;
  return <SiteHeaderAuto cartCount={cart?.count ?? 0} />;
}
