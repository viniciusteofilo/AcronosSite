import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { getDb } from "@/db/client";
import { AngleRule } from "@/components/graphics";
import { Container, PageHeader } from "@/components/storefront/page-parts";
import { SimplePageBody } from "@/components/storefront/simple-page";
import { getSimplePage } from "@/server/content/pages";

export const metadata: Metadata = {
  title: "About",
  description: "ACRONOS: a futurist fashion brand founded in São Paulo in 2018.",
  alternates: { canonical: "/about" },
};

/**
 * Fallback copy uses only facts ACRONOS provided (founded 2018 in São Paulo, Brazilian
 * retail and wholesale history, international expansion being planned). It is replaced
 * by the text published from the admin.
 */
const FALLBACK = {
  intro:
    "ACRONOS is a futurist fashion brand founded in São Paulo, Brazil, in 2018. It works across techwear, streetwear, industrial design and science fiction.",
  sections: [
    {
      heading: "History",
      body: "Since 2018 ACRONOS has sold in Brazil, including wholesale to retailers in different states.",
    },
    {
      heading: "Next",
      body: "ACRONOS is preparing its international expansion, starting with the United States.",
    },
  ],
};

export default function AboutPage() {
  return (
    <Container className="pb-24">
      <PageHeader eyebrow="About //" title="About Acronos" />
      <dl className="grid grid-cols-2 gap-8 border-b border-line py-10 sm:grid-cols-4">
        {[
          ["2018", "Founded"],
          ["São Paulo", "Origin"],
          ["Global", "Vision"],
          ["Future", "Purpose"],
        ].map(([v, k]) => (
          <div key={k} className="flex flex-col-reverse gap-2">
            <dt className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">{k}</dt>
            <dd className="font-display text-xl uppercase tracking-[0.06em]">{v}</dd>
          </div>
        ))}
      </dl>
      <Suspense fallback={<div className="min-h-[30svh]" />}>
        <AboutBody />
      </Suspense>
      <AngleRule className="h-5 w-40 text-muted" />
    </Container>
  );
}

async function AboutBody() {
  await connection();
  const page = (await getSimplePage(getDb(), "about")) ?? FALLBACK;
  return <SimplePageBody page={page} />;
}
