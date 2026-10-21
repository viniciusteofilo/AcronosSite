"use server";

import { getDb } from "@/db/client";
import { getAccessContext } from "@/server/auth";
import { runAdmin } from "@/server/admin/errors";
import { addShipment, cancelUnpaidByStaff, markDelivered, refundOrder, resolveAttention, setProcessing } from "@/server/orders/admin";
import { getPaymentProviders } from "@/server/payments";
import { deleteShipping, saveMerchant, saveMethod, saveStoreSettings, saveZone } from "@/server/store/settings";

export async function setProcessingAction(id: string, status: string) {
  return runAdmin(async () => setProcessing(getDb(), await getAccessContext(), id, status), "Status updated.");
}
export async function addShipmentAction(id: string, input: unknown) {
  return runAdmin(async () => addShipment(getDb(), await getAccessContext(), id, input), "Marked as shipped.");
}
export async function markDeliveredAction(id: string) {
  return runAdmin(async () => markDelivered(getDb(), await getAccessContext(), id), "Marked as delivered.");
}
export async function resolveAttentionAction(id: string) {
  return runAdmin(async () => resolveAttention(getDb(), await getAccessContext(), id), "Marked as resolved.");
}
export async function cancelUnpaidAction(id: string) {
  return runAdmin(async () => cancelUnpaidByStaff(getDb(), await getAccessContext(), id), "Order canceled and stock released.");
}
export async function refundAction(id: string, input: unknown) {
  return runAdmin(async () => refundOrder(getDb(), await getAccessContext(), id, input, getPaymentProviders()), (r) => (r.status === "succeeded" ? "Refund sent." : "Refund requested; the provider is processing it."));
}
export async function saveStoreSettingsAction(input: unknown) {
  return runAdmin(async () => saveStoreSettings(getDb(), await getAccessContext(), input), "Settings saved.");
}
export async function saveMerchantAction(input: unknown) {
  return runAdmin(async () => saveMerchant(getDb(), await getAccessContext(), input), "Legal entity saved.");
}
export async function saveZoneAction(input: unknown) {
  return runAdmin(async () => saveZone(getDb(), await getAccessContext(), input), "Zone saved.");
}
export async function saveMethodAction(input: unknown) {
  return runAdmin(async () => saveMethod(getDb(), await getAccessContext(), input), "Shipping method saved.");
}
export async function deleteShippingAction(kind: "zone" | "method", id: string) {
  return runAdmin(async () => deleteShipping(getDb(), await getAccessContext(), kind, id), "Deleted.");
}
