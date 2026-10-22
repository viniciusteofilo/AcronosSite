import type { Metadata } from "next";
import { Suspense } from "react";
import { getDb } from "@/db/client";
import { HomeView } from "@/components/storefront/home-view";
import { getFeaturedProducts } from "@/server/catalog/featured";
import { requireStaff } from "@/server/auth";
import { getHomeEditorState } from "@/server/content/home";

export const metadata: Metadata = { title: "Preview", robots: { index: false, follow: false } };

/** Shows the saved draft exactly as visitors will see it. Only staff can open it. */
export default function PreviewPage() {
  return (
    <Suspense fallback={<p className="p-8 text-muted">Loading preview…</p>}>
      <Preview />
    </Suspense>
  );
}

async function Preview() {
  const ctx = await requireStaff("content:write");
  const db = getDb();
  const state = await getHomeEditorState(db, ctx);
  const products = await getFeaturedProducts(db, state.draft);
  return (
    <div className="-m-4 bg-canvas md:-m-8">
      <p role="status" className="sticky top-0 z-30 border-b border-signal bg-paper px-4 py-2 text-center font-mono text-[10px] uppercase tracking-[0.18em] text-signal-ink">
        Preview of your draft · not visible to visitors
      </p>
      <HomeView blocks={state.draft} media={state.media} products={products} film={state.film} />
    </div>
  );
}
