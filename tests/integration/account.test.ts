import { afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { orderItems, orders, shipments } from "@/db/schema";
import {
  MAX_ADDRESSES,
  deleteAddress,
  getProfile,
  listAddresses,
  rememberAddress,
  saveAddress,
  updateName,
} from "@/server/account/profile";
import { runAdmin } from "@/server/admin/errors";
import {
  getOrderViewForCustomer,
  listOrdersForCustomer,
} from "@/server/customers/orders";
import { AccessDeniedError } from "@/server/rbac/access";
import { ctxFor, makeMerchant, makeOrder, makeUser, testDb } from "../helpers";

const { db, client } = testDb();
afterAll(() => client.end());

const address = (o: Partial<Record<string, string>> = {}) => ({
  fullName: "Ana Silva",
  line1: "100 Main St",
  city: "Orlando",
  region: "FL",
  postalCode: "32801",
  country: "us",
  ...o,
});

describe("profile and address book", () => {
  it("each person sees and changes only their own data", async () => {
    const ana = ctxFor(await makeUser(db), []);
    const bob = ctxFor(await makeUser(db), []);
    await expect(getProfile(db, null)).rejects.toBeInstanceOf(
      AccessDeniedError,
    );
    await updateName(db, ana, "  Ana Souza ");
    expect((await getProfile(db, ana)).name).toBe("Ana Souza");
    expect((await runAdmin(() => updateName(db, ana, "A"), "ok")).ok).toBe(
      false,
    );

    const id = await saveAddress(db, ana, address());
    const [saved] = await listAddresses(db, ana);
    expect(saved).toMatchObject({ id, country: "US", line2: "", phone: "" });
    expect(await listAddresses(db, bob)).toEqual([]);
    // Bob cannot edit or delete Ana's address, even knowing its id
    expect(
      (
        await runAdmin(
          () => saveAddress(db, bob, { ...address({ line1: "Hacked" }), id }),
          "ok",
        )
      ).message,
    ).toMatch(/not found/);
    expect((await runAdmin(() => deleteAddress(db, bob, id), "ok")).ok).toBe(
      false,
    );
    await saveAddress(db, ana, { ...address({ line1: "200 Main St" }), id });
    expect((await listAddresses(db, ana))[0].line1).toBe("200 Main St");
    expect(
      (
        await runAdmin(
          () => saveAddress(db, ana, address({ country: "Brazil" })),
          "ok",
        )
      ).ok,
    ).toBe(false);
    await deleteAddress(db, ana, id);
    expect(await listAddresses(db, ana)).toEqual([]);
  });

  it("checkout remembers a new address once, and the book has a limit", async () => {
    const u = ctxFor(await makeUser(db), []);
    await rememberAddress(db, u, address());
    await rememberAddress(
      db,
      u,
      address({ fullName: "ana silva", postalCode: " 32801 " }),
    );
    expect(await listAddresses(db, u)).toHaveLength(1);
    await rememberAddress(db, u, { nonsense: true });
    for (let i = 1; i < MAX_ADDRESSES; i++)
      await saveAddress(db, u, address({ line1: `${i} Other St` }));
    expect(
      (
        await runAdmin(
          () => saveAddress(db, u, address({ line1: "One too many" })),
          "ok",
        )
      ).message,
    ).toMatch(/up to 10/);
    await rememberAddress(db, u, address({ line1: "Ignored when full" }));
    expect(await listAddresses(db, u)).toHaveLength(MAX_ADDRESSES);
  });
});

describe("customer order pages", () => {
  it("show items and tracking only to the owner", async () => {
    const owner = await makeUser(db);
    const other = await makeUser(db);
    const m = await makeMerchant(db);
    const o = await makeOrder(db, {
      userId: owner.id,
      merchantId: m.id,
      totalMinor: 12_000,
    });
    await db
      .insert(orderItems)
      .values({
        orderId: o.id,
        productName: "Shell",
        sku: "S-1",
        size: "M",
        color: "Black",
        unitPriceMinor: 12_000,
        quantity: 1,
      });
    await db
      .update(orders)
      .set({
        paymentStatus: "paid",
        paidAt: new Date(),
        fulfillmentStatus: "shipped",
      })
      .where(eq(orders.id, o.id));
    await db
      .insert(shipments)
      .values({
        orderId: o.id,
        carrier: "USPS",
        trackingNumber: "9400",
        trackingUrl: "https://tools.usps.com/t",
        shippedAt: new Date(),
      });

    const view = await getOrderViewForCustomer(db, owner.id, o.id);
    expect(view?.items[0]).toMatchObject({
      productName: "Shell",
      options: "Black / M",
    });
    expect(view?.shipments[0]).toMatchObject({
      carrier: "USPS",
      trackingNumber: "9400",
    });
    expect(await getOrderViewForCustomer(db, other.id, o.id)).toBeNull();
    expect(
      await getOrderViewForCustomer(db, owner.id, "not-a-uuid"),
    ).toBeNull();
    const [row] = await listOrdersForCustomer(db, owner.id);
    expect(row.items).toBe(1);
    expect(JSON.stringify(view)).not.toMatch(
      /publicToken|idempotencyKey|providerCheckoutId/,
    );
  });
});
