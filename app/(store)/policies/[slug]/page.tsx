import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { getDb } from "@/db/client";
import { Container, EmptyState, PageHeader } from "@/components/storefront/page-parts";
import { SimplePageBody } from "@/components/storefront/simple-page";
import { getSimplePage, POLICY_SLUGS, type PolicySlug } from "@/server/content/pages";

export function generateStaticParams() {
  return Object.keys(POLICY_SLUGS).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps<"/policies/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const title = POLICY_SLUGS[slug as PolicySlug];
  return title ? { title, alternates: { canonical: `/policies/${slug}` } } : { title: "Not found" };
}

export default function PolicyPage({ params }: PageProps<"/policies/[slug]">) {
  return (
    <Container className="pb-24">
      <Suspense fallback={<div className="min-h-[50svh]" />}>
        <Policy params={params} />
      </Suspense>
    </Container>
  );
}

/** Legal texts are never invented: until ACRONOS publishes a reviewed text, the page says so. */
async function Policy({ params }: Pick<PageProps<"/policies/[slug]">, "params">) {
  const { slug } = await params;
  const title = POLICY_SLUGS[slug as PolicySlug];
  if (!title) notFound();
  await connection();
  const page = await getSimplePage(getDb(), `policy-${slug}`);
  return (
    <>
      <PageHeader eyebrow="Policies //" title={title} />
      {page ? (
        <SimplePageBody page={page} />
      ) : (
        <div className="py-10">
          <EmptyState title="This policy is being finalized" text="The reviewed text will be published here before the store opens." />
        </div>
      )}
    </>
  );
}
