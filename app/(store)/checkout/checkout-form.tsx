"use client";

import Link from "next/link";
import { useActionState, useMemo, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { formatMoney } from "@/lib/money";
import type { CartResult } from "../cart/actions";

type Method = { id: string; name: string; carrier: string | null; currency: string; priceMinor: number; freeOverMinor: number | null; dutiesModel: string };
type Line = { variantId: string; name: string; variant: string; quantity: number; prices: Record<string, number> };

const regionNames = typeof Intl !== "undefined" && "DisplayNames" in Intl ? new Intl.DisplayNames(["en"], { type: "region" }) : null;
const countryName = (c: string) => regionNames?.of(c) ?? c;

/**
 * Address, shipping and payment choice. Totals shown here are a preview; the server
 * recalculates everything before sending the buyer to Stripe or PayPal.
 */
export function CheckoutForm({
  action,
  email,
  providers,
  options,
  lines,
  backToCart,
  idempotencyKey,
}: {
  /** One key per visit to this page, so a double click or retry never creates two orders. */
  idempotencyKey: string;
  action: (prev: CartResult, form: FormData) => Promise<CartResult>;
  email: string;
  providers: ("stripe" | "paypal")[];
  options: Record<string, Method[]>;
  lines: Line[];
  backToCart: ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const countries = useMemo(() => Object.keys(options).sort((a, b) => countryName(a).localeCompare(countryName(b))), [options]);
  const v = state?.values ?? {};
  const [country, setCountry] = useState(v.country || (countries.includes("US") ? "US" : (countries[0] ?? "")));
  const methods = options[country] ?? [];
  const [methodId, setMethodId] = useState(v.methodId || methods[0]?.id || "");
  const method = methods.find((m) => m.id === methodId) ?? methods[0];
  const currency = method?.currency ?? "USD";
  const unpriced = lines.filter((l) => l.prices[currency] === undefined);
  const subtotal = lines.reduce((s, l) => s + (l.prices[currency] ?? 0) * l.quantity, 0);
  const shipping = method ? (method.freeOverMinor !== null && subtotal >= method.freeOverMinor ? 0 : method.priceMinor) : 0;
  const err = (f: string) => (state && !state.ok && state.field === f ? state.message : undefined);
  const k = JSON.stringify(v);
  const money = (m: number) => formatMoney(m, currency);

  return (
    <form action={formAction} className="grid gap-12 py-10 lg:grid-cols-[minmax(0,1fr)_380px]" noValidate>
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <div className="flex flex-col gap-10">
        <fieldset className="flex flex-col gap-5">
          <legend className="mb-5 font-display text-sm uppercase tracking-[0.1em]">1. Contact</legend>
          <Field key={`e${k}`} id="co-email" name="email" type="email" label="Email" autoComplete="email" required defaultValue={v.email || email} error={err("email")} hint="Order updates are sent here." />
        </fieldset>

        <fieldset className="flex flex-col gap-5">
          <legend className="mb-5 font-display text-sm uppercase tracking-[0.1em]">2. Shipping address</legend>
          <div className="flex flex-col gap-2">
            <label htmlFor="co-country" className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
              Country
            </label>
            <select
              id="co-country"
              name="country"
              value={country}
              autoComplete="country"
              onChange={(e) => {
                setCountry(e.target.value);
                setMethodId(options[e.target.value]?.[0]?.id ?? "");
              }}
              className="h-12 rounded-sm border border-line bg-surface px-4"
            >
              {countries.map((c) => (
                <option key={c} value={c}>
                  {countryName(c)}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted">We currently ship only to the countries listed.</p>
          </div>
          <Field key={`n${k}`} id="co-name" name="fullName" label="Full name" autoComplete="name" required defaultValue={v.fullName} error={err("fullName")} />
          <Field key={`a${k}`} id="co-line1" name="line1" label="Address" autoComplete="address-line1" required defaultValue={v.line1} error={err("line1")} />
          <Field key={`b${k}`} id="co-line2" name="line2" label="Apartment, suite (optional)" autoComplete="address-line2" defaultValue={v.line2} />
          <div className="grid gap-5 sm:grid-cols-3">
            <Field key={`c${k}`} id="co-city" name="city" label="City" autoComplete="address-level2" required defaultValue={v.city} error={err("city")} />
            <Field key={`r${k}`} id="co-region" name="region" label="State / region" autoComplete="address-level1" defaultValue={v.region} />
            <Field key={`p${k}`} id="co-postal" name="postalCode" label="Postal code" autoComplete="postal-code" required defaultValue={v.postalCode} error={err("postalCode")} />
          </div>
          <Field key={`t${k}`} id="co-phone" name="phone" type="tel" label="Phone (for the carrier, optional)" autoComplete="tel" defaultValue={v.phone} />
        </fieldset>

        <fieldset className="flex flex-col gap-3">
          <legend className="mb-5 font-display text-sm uppercase tracking-[0.1em]">3. Shipping method</legend>
          {methods.map((m) => (
            <label key={m.id} className={`flex cursor-pointer items-start justify-between gap-4 border p-4 ${method?.id === m.id ? "border-ink" : "border-line"}`}>
              <span className="flex gap-3">
                <input type="radio" name="methodId" value={m.id} checked={method?.id === m.id} onChange={() => setMethodId(m.id)} className="mt-1" />
                <span className="flex flex-col">
                  <span>{m.name}</span>
                  <span className="text-xs text-muted">
                    {[m.carrier, m.dutiesModel === "ddu" ? "Import duties and taxes, if any, are paid by the recipient on delivery" : null].filter(Boolean).join(" · ")}
                  </span>
                </span>
              </span>
              <span className="font-mono text-sm">{m.freeOverMinor !== null && subtotal >= m.freeOverMinor ? "Free" : formatMoney(m.priceMinor, m.currency)}</span>
            </label>
          ))}
        </fieldset>

        <fieldset className="flex flex-col gap-3">
          <legend className="mb-5 font-display text-sm uppercase tracking-[0.1em]">4. Payment</legend>
          {providers.map((p, i) => (
            <label key={p} className="flex cursor-pointer items-center gap-3 border border-line p-4 has-[:checked]:border-ink">
              <input type="radio" name="provider" value={p} defaultChecked={(v.provider || providers[0]) === p || (!v.provider && i === 0)} />
              <span className="flex flex-col">
                <span>{p === "stripe" ? "Card, Apple Pay or Google Pay" : "PayPal"}</span>
                <span className="text-xs text-muted">{p === "stripe" ? "Secure payment page by Stripe." : "You will log in to PayPal to pay."}</span>
              </span>
            </label>
          ))}
          <p className="text-xs text-muted">Card details are entered on the provider&apos;s secure page; ACRONOS never sees or stores them.</p>
        </fieldset>
      </div>

      <aside className="flex flex-col gap-5 self-start border border-line bg-surface p-6 lg:sticky lg:top-24">
        <h2 className="font-display text-sm uppercase tracking-[0.1em]">Order summary</h2>
        <ul className="flex flex-col gap-3 text-sm">
          {lines.map((l) => (
            <li key={l.variantId} className="flex justify-between gap-3">
              <span>
                {l.name} × {l.quantity}
                {l.variant && <span className="block text-xs text-muted">{l.variant}</span>}
              </span>
              <span className="font-mono">{l.prices[currency] !== undefined ? money(l.prices[currency] * l.quantity) : "—"}</span>
            </li>
          ))}
        </ul>
        <dl className="flex flex-col gap-2 border-t border-line pt-4 font-mono text-sm">
          <div className="flex justify-between">
            <dt>Subtotal</dt>
            <dd>{money(subtotal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Shipping</dt>
            <dd>{shipping === 0 ? "Free" : money(shipping)}</dd>
          </div>
          <div className="flex justify-between border-t border-line pt-2 text-base">
            <dt>Total</dt>
            <dd>{money(subtotal + shipping)}</dd>
          </div>
        </dl>
        {currency !== "USD" && <p className="text-xs text-muted">Prices for this country are in {currency}. The payment page may show the amount in your card&apos;s currency.</p>}
        {unpriced.length > 0 && (
          <p role="alert" className="text-sm text-alert">
            {unpriced.map((l) => l.name).join(", ")} cannot be shipped to {countryName(country)} yet.
          </p>
        )}
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" name="acceptTerms" required className="mt-1" />
          <span>
            I accept the{" "}
            <Link href="/policies/terms" target="_blank" className="underline">
              terms
            </Link>
            ,{" "}
            <Link href="/policies/shipping" target="_blank" className="underline">
              shipping
            </Link>{" "}
            and{" "}
            <Link href="/policies/returns" target="_blank" className="underline">
              returns
            </Link>{" "}
            policies.
          </span>
        </label>
        {state && !state.ok && (
          <p role="alert" className="text-sm text-alert">
            {state.message}
          </p>
        )}
        <Button type="submit" className="w-full" disabled={pending || unpriced.length > 0 || !method}>
          {pending ? "Opening secure payment…" : "Continue to payment"}
        </Button>
        {backToCart}
      </aside>
    </form>
  );
}
