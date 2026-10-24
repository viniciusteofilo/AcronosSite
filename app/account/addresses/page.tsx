import type { Metadata } from "next";
import { Suspense } from "react";
import { getDb } from "@/db/client";
import { AddressBook } from "@/components/account/address-book";
import { COUNTRY_CODES } from "@/lib/countries";
import { listAddresses } from "@/server/account/profile";
import { requireUser } from "@/server/auth";
import { getShippingOptions } from "@/server/store/settings";
import { deleteAddressAction, saveAddressAction } from "../actions";

export const metadata: Metadata = { title: "Addresses", robots: { index: false } };

export default function AddressesPage() {
  return (
    <>
      <h1 className="font-display text-2xl uppercase tracking-[0.08em]">Addresses</h1>
      <Suspense fallback={<p className="text-muted">Loading…</p>}>
        <Body />
      </Suspense>
    </>
  );
}

async function Body() {
  const ctx = await requireUser("/account/addresses");
  const db = getDb();
  const [addresses, options] = await Promise.all([listAddresses(db, ctx), getShippingOptions(db)]);
  return (
    <>
      <p className="text-sm text-muted">
        {options.size ? `We currently ship to ${options.size} ${options.size === 1 ? "country" : "countries"}; others can be saved but not used at checkout yet.` : "Online orders are not open yet; addresses saved here will be offered at checkout."}
      </p>
      <AddressBook addresses={addresses} countries={COUNTRY_CODES} save={saveAddressAction} remove={deleteAddressAction} />
    </>
  );
}
