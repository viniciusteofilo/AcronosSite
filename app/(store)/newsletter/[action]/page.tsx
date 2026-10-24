import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { Container, PageHeader } from "@/components/storefront/page-parts";
import { readNewsletterToken } from "@/server/email/notify";
import { newsletterLinkAction } from "./actions";
import { NewsletterLinkForm } from "./link-form";

export const metadata: Metadata = { title: "Newsletter", robots: { index: false } };

const COPY = {
  confirm: { title: "Confirm subscription", intro: "Confirm that you want to receive ACRONOS news by e-mail.", button: "Confirm subscription" },
  unsubscribe: { title: "Unsubscribe", intro: "Stop receiving ACRONOS news by e-mail.", button: "Unsubscribe" },
} as const;

/**
 * The link only opens this page; the change happens when the person presses the button.
 * E-mail security scanners open links automatically and must not confirm or cancel anything.
 */
export default function NewsletterLinkPage(props: PageProps<"/newsletter/[action]">) {
  return (
    <Container className="pb-24">
      <Suspense fallback={<div className="min-h-[40svh]" />}>
        <Body {...props} />
      </Suspense>
    </Container>
  );
}

async function Body({ params, searchParams }: PageProps<"/newsletter/[action]">) {
  await connection(); // the link's expiry is checked against the current time
  const { action } = await params;
  if (action !== "confirm" && action !== "unsubscribe") notFound();
  const t = (await searchParams).t;
  const token = typeof t === "string" ? t : "";
  const email = token ? readNewsletterToken(token, action) : null;
  const copy = COPY[action];
  return (
    <>
      <PageHeader eyebrow="Newsletter //" title={copy.title} intro={email ? copy.intro : "This link is not valid or has expired. Sign up again from the footer of any page."} />
      {email && (
        <div className="py-10">
          <p className="mb-6 text-sm text-muted">{email}</p>
          <NewsletterLinkForm action={newsletterLinkAction} token={token} purpose={action} label={copy.button} />
        </div>
      )}
    </>
  );
}
