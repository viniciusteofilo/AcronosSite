"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { SavedAddress } from "@/server/account/profile";
import type { ActionResult } from "@/server/admin/errors";

const regionNames =
  typeof Intl !== "undefined" && "DisplayNames" in Intl
    ? new Intl.DisplayNames(["en"], { type: "region" })
    : null;
const countryName = (c: string) => {
  try {
    return regionNames?.of(c) ?? c;
  } catch {
    return c;
  }
};
const EMPTY = {
  fullName: "",
  line1: "",
  line2: "",
  city: "",
  region: "",
  postalCode: "",
  country: "",
  phone: "",
};
const FIELDS: [keyof typeof EMPTY, string, string, boolean][] = [
  ["fullName", "Full name", "name", true],
  ["line1", "Address", "address-line1", true],
  ["line2", "Apartment, suite (optional)", "address-line2", false],
  ["city", "City", "address-level2", true],
  ["region", "State / region", "address-level1", false],
  ["postalCode", "Postal code", "postal-code", true],
  ["phone", "Phone (optional)", "tel", false],
];

export function AddressBook({
  addresses,
  countries,
  save,
  remove,
}: {
  addresses: SavedAddress[];
  countries: string[];
  save: (input: unknown) => Promise<ActionResult<unknown>>;
  remove: (id: string) => Promise<ActionResult<unknown>>;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<
    (typeof EMPTY & { id?: string }) | null
  >(null);
  const [msg, setMsg] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, start] = useTransition();
  const run = (p: () => Promise<ActionResult<unknown>>, done?: () => void) =>
    start(async () => {
      const r = await p();
      setMsg(r);
      if (r.ok) {
        done?.();
        router.refresh();
      }
    });
  const options = [
    ...new Set([...countries, ...(editing?.country ? [editing.country] : [])]),
  ].sort((a, b) => countryName(a).localeCompare(countryName(b)));

  return (
    <div className="flex flex-col gap-6">
      {addresses.length === 0 && !editing && (
        <p className="text-sm text-muted">
          No saved addresses. Addresses you use at checkout can be saved here
          for next time.
        </p>
      )}
      <ul className="grid gap-4 sm:grid-cols-2">
        {addresses.map((a) => (
          <li
            key={a.id}
            className="flex flex-col justify-between gap-4 border border-line bg-surface p-4 text-sm"
          >
            <address className="not-italic leading-relaxed">
              {a.fullName}
              <br />
              {a.line1}
              {a.line2 && (
                <>
                  <br />
                  {a.line2}
                </>
              )}
              <br />
              {a.city} {a.region} {a.postalCode}
              <br />
              {countryName(a.country)}
              {a.phone && (
                <>
                  <br />
                  {a.phone}
                </>
              )}
            </address>
            <div className="flex gap-4 font-mono text-[10px] uppercase tracking-[0.14em]">
              <button
                type="button"
                onClick={() => setEditing({ ...a })}
                className="underline underline-offset-4"
              >
                Edit<span className="sr-only"> address {a.line1}</span>
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => remove(a.id))}
                className="text-alert underline underline-offset-4"
              >
                Remove<span className="sr-only"> address {a.line1}</span>
              </button>
            </div>
          </li>
        ))}
      </ul>
      {editing ? (
        <form
          className="flex flex-col gap-4 border border-line p-5"
          onSubmit={(e) => {
            e.preventDefault();
            run(
              () => save(editing),
              () => setEditing(null),
            );
          }}
          noValidate
        >
          <h2 className="font-display text-sm uppercase tracking-[0.1em]">
            {editing.id ? "Edit address" : "New address"}
          </h2>
          <div className="flex flex-col gap-2">
            <label
              htmlFor="ab-country"
              className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted"
            >
              Country
            </label>
            <select
              id="ab-country"
              value={editing.country}
              onChange={(e) =>
                setEditing({ ...editing, country: e.target.value })
              }
              autoComplete="country"
              className="h-11 border border-line bg-surface px-3 text-sm"
            >
              <option value="">Choose…</option>
              {options.map((c) => (
                <option key={c} value={c}>
                  {countryName(c)}
                </option>
              ))}
            </select>
          </div>
          {FIELDS.map(([k, label, ac, req]) => (
            <div key={k} className="flex flex-col gap-2">
              <label
                htmlFor={`ab-${k}`}
                className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted"
              >
                {label}
              </label>
              <input
                id={`ab-${k}`}
                value={editing[k]}
                required={req}
                autoComplete={ac}
                maxLength={k === "postalCode" ? 20 : 200}
                onChange={(e) =>
                  setEditing({ ...editing, [k]: e.target.value })
                }
                className="h-11 border border-line bg-surface px-3 text-sm"
              />
            </div>
          ))}
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={pending}
              className="h-10 bg-ink px-4 font-mono text-[10px] uppercase tracking-[0.14em] text-canvas disabled:opacity-50"
            >
              Save address
            </button>
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="h-10 px-3 font-mono text-[10px] uppercase tracking-[0.14em] underline"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => {
            setMsg(null);
            setEditing({ ...EMPTY });
          }}
          className="self-start border border-field px-4 py-2 font-mono text-[10px] uppercase tracking-[0.14em] hover:border-ink"
        >
          Add address
        </button>
      )}
      {msg && (
        <p
          role={msg.ok ? "status" : "alert"}
          className={`text-sm ${msg.ok ? "" : "text-alert"}`}
        >
          {msg.message}
        </p>
      )}
    </div>
  );
}
