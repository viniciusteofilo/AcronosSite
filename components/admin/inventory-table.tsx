"use client";

import Link from "next/link";
import { Fragment, useState, useTransition } from "react";
import type { ActionResult } from "@/server/admin/errors";
import { Notice, inputClass, smallButton } from "./ui";

type Row = {
  variantId: string;
  productId: string;
  productName: string;
  productStatus: string;
  sku: string;
  size: string | null;
  color: string | null;
  onHand: number;
  reserved: number;
  threshold: number;
  available: number;
};

type Movement = { id: string; delta: number; reasonLabel: string; note: string | null; createdAt: string; actor: string | null };

const REASONS = [
  ["receipt", "Received from production"],
  ["count_correction", "Stock count correction"],
  ["return", "Customer return"],
  ["damage", "Damaged / lost"],
  ["manual_adjustment", "Other adjustment"],
] as const;

/** Stock per variant. Each change needs a reason and is kept in the history. */
export function InventoryTable({
  rows: initial,
  actions,
}: {
  rows: Row[];
  actions: {
    adjust: (input: unknown) => Promise<ActionResult<{ onHand: number; reserved: number }>>;
    threshold: (variantId: string, threshold: number) => Promise<ActionResult<void>>;
    history: (variantId: string) => Promise<ActionResult<Movement[]>>;
  };
}) {
  const [rows, setRows] = useState(initial);
  const [open, setOpen] = useState<string | null>(null);
  const [form, setForm] = useState({ mode: "add" as "add" | "remove", qty: "", reason: "receipt", note: "" });
  const [history, setHistory] = useState<Movement[] | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, start] = useTransition();

  function openRow(id: string) {
    if (open === id) {
      setOpen(null);
      return;
    }
    setOpen(id);
    setForm({ mode: "add", qty: "", reason: "receipt", note: "" });
    setHistory(null);
    start(async () => {
      const r = await actions.history(id);
      setHistory(r.ok ? (r.data ?? []) : []);
    });
  }

  function apply(row: Row) {
    const qty = Number.parseInt(form.qty, 10);
    if (!qty || qty < 1) {
      setNotice({ ok: false, message: "Enter how many units." });
      return;
    }
    const delta = form.mode === "add" ? qty : -qty;
    start(async () => {
      const r = await actions.adjust({ variantId: row.variantId, delta, reason: form.reason, note: form.note });
      setNotice(r.ok ? { ok: true, message: `${row.sku}: ${delta > 0 ? "+" : ""}${delta}. On hand now ${r.data?.onHand}.` } : r);
      if (r.ok && r.data) {
        const { onHand, reserved } = r.data;
        setRows((all) => all.map((x) => (x.variantId === row.variantId ? { ...x, onHand, reserved, available: Math.max(onHand - reserved, 0) } : x)));
        setForm({ ...form, qty: "", note: "" });
        const h = await actions.history(row.variantId);
        setHistory(h.ok ? (h.data ?? []) : []);
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <Notice result={notice} />
      {rows.length === 0 ? (
        <p className="border border-dashed border-field p-8 text-sm text-muted">Nothing here.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-line text-left font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
                <th className="py-2 pr-3 font-normal">Product</th>
                <th className="py-2 pr-3 font-normal">SKU</th>
                <th className="py-2 pr-3 text-right font-normal">On hand</th>
                <th className="py-2 pr-3 text-right font-normal">In open orders</th>
                <th className="py-2 pr-3 text-right font-normal">Available</th>
                <th className="py-2 pr-3 text-right font-normal">Alert at</th>
                <th className="py-2 font-normal">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const low = r.available > 0 && r.available <= r.threshold;
                return (
                  <Fragment key={r.variantId}>
                    <tr className="border-b border-line">
                      <td className="py-2 pr-3">
                        <Link href={`/admin/products/${r.productId}`} className="hover:underline">
                          {r.productName}
                        </Link>
                        <span className="block text-xs text-muted">{[r.color, r.size].filter(Boolean).join(" / ") || "—"}</span>
                      </td>
                      <td className="py-2 pr-3 font-mono text-xs">{r.sku}</td>
                      <td className="py-2 pr-3 text-right">{r.onHand}</td>
                      <td className="py-2 pr-3 text-right text-muted">{r.reserved}</td>
                      <td className={`py-2 pr-3 text-right ${r.available === 0 ? "text-alert" : low ? "text-alert" : ""}`}>
                        {r.available === 0 ? "Sold out" : r.available}
                        {low && <span className="block text-[10px] uppercase tracking-[0.1em]">low</span>}
                      </td>
                      <td className="py-2 pr-3 text-right">
                        <input
                          type="number"
                          min={0}
                          max={10000}
                          defaultValue={r.threshold}
                          aria-label={`Low-stock alert level for ${r.sku}`}
                          className="h-8 w-16 border border-field bg-paper px-2 text-right text-sm"
                          onBlur={(e) => {
                            const v = Number(e.target.value);
                            if (Number.isInteger(v) && v !== r.threshold) {
                              start(async () => {
                                const res = await actions.threshold(r.variantId, v);
                                setNotice(res);
                                if (res.ok) setRows((all) => all.map((x) => (x.variantId === r.variantId ? { ...x, threshold: v } : x)));
                              });
                            }
                          }}
                        />
                      </td>
                      <td className="py-2 text-right">
                        <button type="button" aria-expanded={open === r.variantId} onClick={() => openRow(r.variantId)} className={smallButton}>
                          {open === r.variantId ? "Close" : "Adjust"}
                        </button>
                      </td>
                    </tr>
                    {open === r.variantId && (
                      <tr className="border-b border-line bg-paper">
                        <td colSpan={7} className="p-4">
                          <div className="grid gap-6 lg:grid-cols-2">
                            <form
                              className="flex flex-wrap items-end gap-3"
                              onSubmit={(e) => {
                                e.preventDefault();
                                apply(r);
                              }}
                            >
                              <fieldset className="flex gap-1">
                                <legend className="sr-only">Add or remove</legend>
                                {(["add", "remove"] as const).map((m) => (
                                  <label key={m} className={`flex h-10 cursor-pointer items-center border px-3 font-mono text-[10px] uppercase tracking-[0.14em] ${form.mode === m ? "border-ink bg-ink text-canvas" : "border-field"}`}>
                                    <input
                                      type="radio"
                                      className="sr-only"
                                      checked={form.mode === m}
                                      onChange={() => setForm({ ...form, mode: m, reason: m === "add" ? "receipt" : "damage" })}
                                    />
                                    {m === "add" ? "+ Add" : "− Remove"}
                                  </label>
                                ))}
                              </fieldset>
                              <label className="flex flex-col gap-1 text-xs text-muted">
                                Units
                                <input value={form.qty} inputMode="numeric" onChange={(e) => setForm({ ...form, qty: e.target.value.replace(/\D/g, "") })} className={`${inputClass} w-20`} />
                              </label>
                              <label className="flex flex-col gap-1 text-xs text-muted">
                                Reason
                                <select value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} className={`${inputClass} w-56`}>
                                  {REASONS.map(([v, l]) => (
                                    <option key={v} value={v}>
                                      {l}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <label className="flex flex-col gap-1 text-xs text-muted">
                                Note (optional)
                                <input value={form.note} maxLength={300} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="e.g. Batch from supplier" className={`${inputClass} w-56`} />
                              </label>
                              <button type="submit" disabled={pending} className="h-10 bg-ink px-5 font-mono text-[10px] uppercase tracking-[0.14em] text-canvas hover:bg-muted disabled:opacity-50">
                                Apply
                              </button>
                            </form>
                            <div className="flex flex-col gap-2">
                              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">History</p>
                              {!history && <p className="text-xs text-muted">Loading…</p>}
                              {history && history.length === 0 && <p className="text-xs text-muted">No movements yet.</p>}
                              {history && history.length > 0 && (
                                <ul className="max-h-48 overflow-y-auto text-xs">
                                  {history.map((m) => (
                                    <li key={m.id} className="flex gap-3 border-b border-line py-1.5">
                                      <span className={`w-10 shrink-0 text-right font-mono ${m.delta > 0 ? "text-signal-ink" : "text-alert"}`}>
                                        {m.delta > 0 ? "+" : ""}
                                        {m.delta}
                                      </span>
                                      <span className="min-w-0 flex-1">
                                        {m.reasonLabel}
                                        {m.note && <span className="text-muted"> · {m.note}</span>}
                                      </span>
                                      <span className="shrink-0 text-muted">
                                        {new Date(m.createdAt).toLocaleString("en-US", { dateStyle: "short", timeStyle: "short" })}
                                        {m.actor && ` · ${m.actor}`}
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
