import type { Metadata } from "next";
import { Suspense } from "react";
import { getDb } from "@/db/client";
import { AdminPageHeader } from "@/components/admin/page-header";
import { StoreSettingsEditor } from "@/components/admin/store-settings";
import { requireStaff } from "@/server/auth";
import { paymentEnvStatus } from "@/server/payments";
import { getCheckoutReadiness, getStoreSettings, listMerchants, listShipping } from "@/server/store/settings";
import { deleteShippingAction, saveMerchantAction, saveMethodAction, saveStoreSettingsAction, saveZoneAction } from "../orders/actions";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader title="Store settings" description="Company, payments and shipping. The store only opens for orders when all of them are ready." />
      <Suspense fallback={<p className="text-muted">Loading…</p>}>
        <Settings />
      </Suspense>
    </div>
  );
}

async function Settings() {
  const ctx = await requireStaff("settings:manage");
  const db = getDb();
  const [settings, merchants, zones] = await Promise.all([getStoreSettings(db), listMerchants(db, ctx), listShipping(db, ctx)]);
  const readiness = await getCheckoutReadiness(db, settings);
  const merchant = merchants.find((m) => m.id === settings.merchantEntityId) ?? null;
  return (
    <StoreSettingsEditor
      settings={settings}
      readiness={readiness}
      merchant={merchant}
      env={paymentEnvStatus()}
      zones={zones}
      webhookBase={process.env.NEXT_PUBLIC_SITE_URL ?? ""}
      actions={{ settings: saveStoreSettingsAction, merchant: saveMerchantAction, zone: saveZoneAction, method: saveMethodAction, remove: deleteShippingAction }}
    />
  );
}
