"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { formatMoney } from "@/lib/money";
import { minorToInput, parseMoneyInput } from "@/lib/slug";
import type { ActionResult } from "@/server/admin/errors";
import { Notice, Panel, inputClass, primaryButton, secondaryButton, smallButton } from "./ui";

type Zone = { id: string; name: string; countries: string[]; isEnabled: boolean; methods: Method[] };
type Method = { id: string; zoneId: string; name: string; carrier: string | null; currency: string; priceMinor: number; freeOverMinor: number | null; dutiesModel: string; isActive: boolean };
type Act = (input: unknown) => Promise<ActionResult<unknown>>;

/** Checkbox that flips immediately and goes back if the server refuses. */
function Toggle({ checked, disabled, label, onToggle }: { checked: boolean; disabled?: boolean; label: string; onToggle: (v: boolean) => Promise<boolean> }) {
  const [value, setValue] = useState(checked);
  const [busy, setBusy] = useState(false);
  return (
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={value}
        disabled={disabled || busy}
        onChange={async (e) => {
          const v = e.target.checked;
          setValue(v);
          setBusy(true);
          const ok = await onToggle(v);
          if (!ok) setValue(!v);
          setBusy(false);
        }}
      />
      {label}
    </label>
  );
}

/** Everything that must be true before the store takes orders, in one place. */
export function StoreSettingsEditor({
  settings,
  readiness,
  merchant,
  env,
  zones,
  webhookBase,
  actions,
}: {
  settings: { checkoutOpen: boolean; stripeEnabled: boolean; paypalEnabled: boolean; reservationMinutes: number };
  readiness: { open: boolean; missing: string[] };
  merchant: { id: string; legalName: string; country: string; taxId: string | null; settlementCurrency: string } | null;
  env: { stripe: { configured: boolean; environment: string; missing: string[] }; paypal: { configured: boolean; environment: string; missing: string[] } };
  zones: Zone[];
  webhookBase: string;
  actions: { settings: Act; merchant: Act; zone: Act; method: Act; remove: (kind: "zone" | "method", id: string) => Promise<ActionResult<unknown>> };
}) {
  const router = useRouter();
  const [notice, setNotice] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, start] = useTransition();
  const [m, setM] = useState({ legalName: merchant?.legalName ?? "", country: merchant?.country ?? "BR", taxId: merchant?.taxId ?? "", settlementCurrency: merchant?.settlementCurrency ?? "BRL" });
  const [newZone, setNewZone] = useState({ name: "", countries: "" });
  const run = (p: Promise<ActionResult<unknown>>) =>
    start(async () => {
      const r = await p;
      setNotice(r);
      if (r.ok) router.refresh();
    });
  const call = async (p: Promise<ActionResult<unknown>>) => {
    const r = await p;
    setNotice(r);
    if (r.ok) router.refresh();
    return r.ok;
  };

  return (
    <div className="flex flex-col gap-6 pb-24">
      <Notice result={notice} />
      <Panel title="Store status">
        {settings.checkoutOpen && readiness.open ? (
          <p className="text-sm">
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-signal">Open</span> · Customers can add to cart and pay.
          </p>
        ) : (
          <>
            <p className="text-sm">The store is closed for orders. Product pages say &ldquo;Online store opening soon&rdquo;.</p>
            {readiness.missing.length > 0 && (
              <ul className="flex flex-col gap-1 text-sm">
                {readiness.missing.map((x) => (
                  <li key={x} className="flex gap-2">
                    <span className="text-alert" aria-hidden>
                      ○
                    </span>
                    {x}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
        <div className="flex flex-wrap gap-2">
          {settings.checkoutOpen ? (
            <button type="button" className={secondaryButton} disabled={pending} onClick={() => run(actions.settings({ checkoutOpen: false }))}>
              Close the store for orders
            </button>
          ) : (
            <button type="button" className={primaryButton} disabled={pending} onClick={() => run(actions.settings({ checkoutOpen: true }))}>
              Open the store for orders
            </button>
          )}
        </div>
        {(env.stripe.environment === "sandbox" || env.paypal.environment === "sandbox") && (env.stripe.configured || env.paypal.configured) && (
          <p className="border border-alert/50 bg-paper p-3 text-xs">Test mode: payments use sandbox keys and no real money moves. Switch to live keys only after the accounts are approved.</p>
        )}
      </Panel>

      <Panel title="Legal entity" note="The company that sells and receives the money. Shown on orders and receipts.">
        <form
          className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_90px_minmax(0,1fr)_110px_auto] sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            run(actions.merchant({ id: merchant?.id, ...m }));
          }}
        >
          <label className="flex flex-col gap-1 text-xs text-muted">
            Legal name
            <input value={m.legalName} onChange={(e) => setM({ ...m, legalName: e.target.value })} placeholder="Company legal name" className={inputClass} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted">
            Country
            <input value={m.country} maxLength={2} onChange={(e) => setM({ ...m, country: e.target.value.toUpperCase() })} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted">
            Tax ID (CNPJ / EIN)
            <input value={m.taxId} onChange={(e) => setM({ ...m, taxId: e.target.value })} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted">
            Payout currency
            <input value={m.settlementCurrency} maxLength={3} onChange={(e) => setM({ ...m, settlementCurrency: e.target.value.toUpperCase() })} className={inputClass} />
          </label>
          <button type="submit" className={primaryButton} disabled={pending}>
            Save
          </button>
        </form>
      </Panel>

      <Panel title="Payments" note="Keys live in the server environment, never in the database. Enable a method once its keys are set.">
        {(["stripe", "paypal"] as const).map((p) => {
          const e = env[p];
          const enabled = p === "stripe" ? settings.stripeEnabled : settings.paypalEnabled;
          return (
            <div key={p} className="flex flex-col gap-2 border border-line bg-paper p-4 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">{p === "stripe" ? "Stripe (cards, Apple Pay, Google Pay)" : "PayPal"}</span>
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
                  {e.configured ? `Keys set · ${e.environment === "live" ? "LIVE" : "test mode"}` : `Missing: ${e.missing.join(", ")}`}
                </span>
              </div>
              <p className="text-xs text-muted">
                Webhook address to add in the {p === "stripe" ? "Stripe" : "PayPal"} dashboard: <code className="font-mono">{`${webhookBase}/api/webhooks/${p}`}</code>
                {p === "stripe"
                  ? " — events: checkout.session.completed, checkout.session.async_payment_succeeded, checkout.session.async_payment_failed, checkout.session.expired, refund.updated."
                  : " — events: PAYMENT.CAPTURE.COMPLETED, PAYMENT.CAPTURE.DENIED, PAYMENT.CAPTURE.REFUNDED."}
              </p>
              <Toggle
                checked={enabled}
                disabled={!e.configured && !enabled}
                label="Offer at checkout"
                onToggle={(v) => call(actions.settings(p === "stripe" ? { stripeEnabled: v } : { paypalEnabled: v }))}
              />
            </div>
          );
        })}
        <label className="flex items-center gap-3 text-sm">
          Hold stock during payment for
          <select
            value={settings.reservationMinutes}
            onChange={(e) => run(actions.settings({ reservationMinutes: Number(e.target.value) }))}
            className="h-9 border border-field bg-paper px-2"
          >
            {[30, 45, 60, 90, 120].map((n) => (
              <option key={n} value={n}>
                {n} minutes
              </option>
            ))}
          </select>
        </label>
      </Panel>

      <Panel title="Shipping" note="Customers can only choose countries in an active zone with an active method. Validate freight, duties and taxes before activating a country.">
        {zones.length === 0 && <p className="text-sm text-muted">No zones yet.</p>}
        {zones.map((z) => (
          <ZoneCard key={z.id} zone={z} pending={pending} run={run} call={call} actions={actions} />
        ))}
        <form
          className="flex flex-wrap items-end gap-3 border-t border-line pt-4"
          onSubmit={(e) => {
            e.preventDefault();
            run(actions.zone({ name: newZone.name, countries: newZone.countries, isEnabled: false }));
            setNewZone({ name: "", countries: "" });
          }}
        >
          <label className="flex flex-col gap-1 text-xs text-muted">
            New zone
            <input value={newZone.name} onChange={(e) => setNewZone({ ...newZone, name: e.target.value })} placeholder="e.g. United States" className={`${inputClass} w-56`} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted">
            Countries (two-letter codes)
            <input value={newZone.countries} onChange={(e) => setNewZone({ ...newZone, countries: e.target.value })} placeholder="US" className={`${inputClass} w-56`} />
          </label>
          <button type="submit" className={smallButton} disabled={pending}>
            Add zone
          </button>
        </form>
      </Panel>
    </div>
  );
}

function ZoneCard({ zone, pending, run, call, actions }: { zone: Zone; pending: boolean; run: (p: Promise<ActionResult<unknown>>) => void; call: (p: Promise<ActionResult<unknown>>) => Promise<boolean>; actions: { zone: Act; method: Act; remove: (kind: "zone" | "method", id: string) => Promise<ActionResult<unknown>> } }) {
  const [form, setForm] = useState({ name: "", carrier: "", currency: zone.countries.includes("US") ? "USD" : "BRL", price: "", freeOver: "", dutiesModel: zone.countries.length === 1 && zone.countries[0] === "BR" ? "domestic" : "ddu" });
  return (
    <div className="flex flex-col gap-3 border border-line bg-paper p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span>
          <span className="font-medium">{zone.name}</span> <span className="font-mono text-xs text-muted">{zone.countries.join(", ")}</span>
        </span>
        <span className="flex items-center gap-3">
          <Toggle checked={zone.isEnabled} label="Active" onToggle={(v) => call(actions.zone({ id: zone.id, name: zone.name, countries: zone.countries.join(","), isEnabled: v }))} />
          <button type="button" className="font-mono text-[10px] uppercase tracking-[0.14em] text-alert hover:underline" onClick={() => run(actions.remove("zone", zone.id))}>
            Delete
          </button>
        </span>
      </div>
      <ul className="flex flex-col divide-y divide-line text-sm">
        {zone.methods.map((mt) => (
          <li key={mt.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <span>
              {mt.name} {mt.carrier && <span className="text-muted">· {mt.carrier}</span>}
              <span className="block text-xs text-muted">
                {formatMoney(mt.priceMinor, mt.currency)}
                {mt.freeOverMinor !== null && ` · free over ${formatMoney(mt.freeOverMinor, mt.currency)}`} · {mt.dutiesModel === "ddu" ? "duties paid by recipient" : "domestic"}
              </span>
            </span>
            <span className="flex items-center gap-3">
              <Toggle checked={mt.isActive} label="Active" onToggle={(v) => call(actions.method({ ...mt, carrier: mt.carrier ?? "", isActive: v }))} />
              <button type="button" className="font-mono text-[10px] uppercase tracking-[0.14em] text-alert hover:underline" onClick={() => run(actions.remove("method", mt.id))}>
                Delete
              </button>
            </span>
          </li>
        ))}
      </ul>
      <form
        className="grid gap-2 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_80px_100px_110px_140px_auto] sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          const price = parseMoneyInput(form.price);
          const free = parseMoneyInput(form.freeOver);
          run(
            actions.method({
              zoneId: zone.id,
              name: form.name,
              carrier: form.carrier,
              currency: form.currency,
              priceMinor: typeof price === "number" ? price : -1,
              freeOverMinor: typeof free === "number" ? free : null,
              dutiesModel: form.dutiesModel,
              isActive: false,
            }),
          );
        }}
      >
        <label className="flex flex-col gap-1 text-xs text-muted">
          Method
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Standard" className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          Carrier
          <input value={form.carrier} onChange={(e) => setForm({ ...form, carrier: e.target.value })} placeholder="Correios, DHL…" className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          Currency
          <select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} className={inputClass}>
            <option>USD</option>
            <option>BRL</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          Price
          <input value={form.price} inputMode="decimal" onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder={minorToInput(0)} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          Free over (opt.)
          <input value={form.freeOver} inputMode="decimal" onChange={(e) => setForm({ ...form, freeOver: e.target.value })} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          Duties
          <select value={form.dutiesModel} onChange={(e) => setForm({ ...form, dutiesModel: e.target.value })} className={inputClass}>
            <option value="ddu">Recipient pays (DDU)</option>
            <option value="domestic">Domestic</option>
          </select>
        </label>
        <button type="submit" className={smallButton} disabled={pending}>
          Add
        </button>
      </form>
      <p className="text-[11px] text-muted">Prepaid duties (DDP) need a duty calculation agreed with a customs broker; not available yet.</p>
    </div>
  );
}
