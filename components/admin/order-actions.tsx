"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { parseMoneyInput } from "@/lib/slug";
import type { ActionResult } from "@/server/admin/errors";
import { Notice, inputClass, primaryButton, secondaryButton, smallButton } from "./ui";


/** Buttons and forms on the order page: prepare, ship with tracking, deliver, refund. */
export function OrderActions({
  order,
  can,
  actions,
}: {
  order: { id: string; currency: string; paymentStatus: string; processingStatus: string; fulfillmentStatus: string; refundableMinor: number; needsAttention: string | null };
  can: { update: boolean; refund: boolean };
  actions: {
    processing: (id: string, s: string) => Promise<ActionResult<unknown>>;
    ship: (id: string, input: unknown) => Promise<ActionResult<unknown>>;
    delivered: (id: string) => Promise<ActionResult<unknown>>;
    resolve: (id: string) => Promise<ActionResult<unknown>>;
    cancel: (id: string) => Promise<ActionResult<unknown>>;
    refund: (id: string, input: unknown) => Promise<ActionResult<unknown>>;
  };
}) {
  const router = useRouter();
  const [notice, setNotice] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, start] = useTransition();
  const [ship, setShip] = useState({ carrier: "", trackingNumber: "", trackingUrl: "" });
  const [refund, setRefund] = useState({ amount: (order.refundableMinor / 100).toFixed(2), reason: "", restock: false, confirm: false });
  const run = (p: Promise<ActionResult<unknown>>) =>
    start(async () => {
      const r = await p;
      setNotice(r);
      if (r.ok) router.refresh();
    });
  const paid = order.paymentStatus === "paid" || order.paymentStatus === "partially_refunded";

  return (
    <div className="flex flex-col gap-4">
      <Notice result={notice} />
      {order.needsAttention && can.update && (
        <button type="button" className={`${smallButton} self-start`} disabled={pending} onClick={() => run(actions.resolve(order.id))}>
          Mark issue as resolved
        </button>
      )}
      {order.paymentStatus === "pending" && can.update && (
        <button type="button" className={`${secondaryButton} self-start`} disabled={pending} onClick={() => run(actions.cancel(order.id))}>
          Cancel unpaid order (releases stock)
        </button>
      )}
      {paid && can.update && order.fulfillmentStatus === "unfulfilled" && (
        <>
          <div className="flex flex-wrap gap-2">
            {(["processing", "ready"] as const).map((s) => (
              <button key={s} type="button" className={smallButton} disabled={pending || order.processingStatus === s} onClick={() => run(actions.processing(order.id, s))}>
                {s === "processing" ? "Preparing" : "Packed, ready to ship"}
              </button>
            ))}
          </div>
          <form
            className="flex flex-col gap-3 border border-line bg-paper p-4"
            onSubmit={(e) => {
              e.preventDefault();
              run(actions.ship(order.id, ship));
            }}
          >
            <p className="font-mono text-[10px] uppercase tracking-[0.16em]">Ship</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="flex flex-col gap-1 text-xs text-muted">
                Carrier
                <input value={ship.carrier} onChange={(e) => setShip({ ...ship, carrier: e.target.value })} placeholder="e.g. Correios, DHL" className={inputClass} />
              </label>
              <label className="flex flex-col gap-1 text-xs text-muted">
                Tracking number
                <input value={ship.trackingNumber} onChange={(e) => setShip({ ...ship, trackingNumber: e.target.value })} className={inputClass} />
              </label>
              <label className="flex flex-col gap-1 text-xs text-muted">
                Tracking link (optional)
                <input value={ship.trackingUrl} onChange={(e) => setShip({ ...ship, trackingUrl: e.target.value })} placeholder="https://" className={inputClass} />
              </label>
            </div>
            <button type="submit" className={`${primaryButton} self-start`} disabled={pending}>
              Mark as shipped
            </button>
          </form>
        </>
      )}
      {order.fulfillmentStatus === "shipped" && can.update && (
        <button type="button" className={`${secondaryButton} self-start`} disabled={pending} onClick={() => run(actions.delivered(order.id))}>
          Mark as delivered
        </button>
      )}
      {paid && can.refund && order.refundableMinor > 0 && (
        <form
          className="flex flex-col gap-3 border border-alert/50 bg-paper p-4"
          onSubmit={(e) => {
            e.preventDefault();
            const minor = parseMoneyInput(refund.amount);
            if (typeof minor !== "number" || minor <= 0) {
              setNotice({ ok: false, message: "Enter an amount like 49.90" });
              return;
            }
            if (!refund.confirm) {
              setRefund({ ...refund, confirm: true });
              return;
            }
            run(actions.refund(order.id, { amountMinor: minor, reason: refund.reason, restock: refund.restock }));
            setRefund({ ...refund, confirm: false });
          }}
        >
          <p className="font-mono text-[10px] uppercase tracking-[0.16em]">Refund</p>
          <div className="grid gap-3 sm:grid-cols-[140px_minmax(0,1fr)]">
            <label className="flex flex-col gap-1 text-xs text-muted">
              Amount ({order.currency})
              <input value={refund.amount} inputMode="decimal" onChange={(e) => setRefund({ ...refund, amount: e.target.value, confirm: false })} className={inputClass} />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted">
              Reason (sent to the customer by PayPal)
              <input value={refund.reason} maxLength={300} onChange={(e) => setRefund({ ...refund, reason: e.target.value })} className={inputClass} />
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={refund.restock} onChange={(e) => setRefund({ ...refund, restock: e.target.checked })} /> Put the items back in stock
          </label>
          <button type="submit" disabled={pending} className={refund.confirm ? "h-10 self-start bg-alert px-5 font-mono text-[10px] uppercase tracking-[0.14em] text-paper" : `${secondaryButton} self-start`}>
            {refund.confirm ? `Confirm refund of ${refund.amount} ${order.currency}` : "Refund"}
          </button>
        </form>
      )}
    </div>
  );
}
