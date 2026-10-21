"use server";

import { getDb } from "@/db/client";
import { getAccessContext } from "@/server/auth";
import { runAdmin } from "@/server/admin/errors";
import { deleteCategory, deleteProduct, duplicateProduct, getProductForEditor, saveCategory, saveProduct } from "@/server/catalog/admin";
import { deleteCollection, saveCollection } from "@/server/catalog/collections-admin";
import { adjustStock, listMovements, setLowStockThreshold } from "@/server/catalog/inventory";

// Every action re-reads the session, roles, MFA and permission on the server.

export async function saveProductAction(input: unknown) {
  return runAdmin(
    async () => {
      const db = getDb();
      const ctx = await getAccessContext();
      const saved = await saveProduct(db, ctx, input);
      // send back the fresh state (new ids, stock and version) so the screen continues from it
      return { ...saved, product: await getProductForEditor(db, ctx, saved.id) };
    },
    (r) => ["Saved.", ...r.notes].join(" "),
  );
}

export async function duplicateProductAction(id: string) {
  return runAdmin(async () => duplicateProduct(getDb(), await getAccessContext(), id), "Copy created as a draft.");
}

export async function deleteProductAction(id: string) {
  return runAdmin(async () => deleteProduct(getDb(), await getAccessContext(), id), "Product deleted.");
}

export async function saveCategoryAction(input: unknown) {
  return runAdmin(async () => saveCategory(getDb(), await getAccessContext(), input), "Category saved.");
}

export async function deleteCategoryAction(id: string) {
  return runAdmin(async () => deleteCategory(getDb(), await getAccessContext(), id), "Category deleted.");
}

export async function saveCollectionAction(input: unknown) {
  return runAdmin(async () => saveCollection(getDb(), await getAccessContext(), input), "Collection saved.");
}

export async function deleteCollectionAction(id: string) {
  return runAdmin(async () => deleteCollection(getDb(), await getAccessContext(), id), "Collection deleted. Its products were kept.");
}

export async function adjustStockAction(input: unknown) {
  return runAdmin(async () => adjustStock(getDb(), await getAccessContext(), input), "Stock updated.");
}

export async function setThresholdAction(variantId: string, threshold: number) {
  return runAdmin(async () => setLowStockThreshold(getDb(), await getAccessContext(), variantId, threshold), "Alert level saved.");
}

export async function listMovementsAction(variantId: string) {
  return runAdmin(async () => listMovements(getDb(), await getAccessContext(), variantId), "");
}
