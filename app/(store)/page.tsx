import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { getDb } from "@/db/client";
import { HomeView } from "@/components/storefront/home-view";
import { getFeaturedProducts } from "@/server/catalog/featured";
import { getLiveHome } from "@/server/content/home";

export const metadata: Metadata = {
  title: { absolute: "ACRONOS — Future observed from everyday chaos." },
  description: "ACRONOS is a futurist fashion brand from São Paulo: techwear, streetwear and industrial design.",
  alternates: { canonical: "/" },
};

export default function HomePage() {
  return (
    <Suspense fallback={<div className="min-h-[80svh]" aria-busy="true" />}>
      <HomeContent />
    </Suspense>
  );
}

/** Read on every request so a published or scheduled campaign shows up immediately. */
async function HomeContent() {
  await connection();
  const db = getDb();
  const home = await getLiveHome(db);
  const products = await getFeaturedProducts(db, home.blocks);
  return <HomeView blocks={home.blocks} media={home.media} products={products} />;
}
