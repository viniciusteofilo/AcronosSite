import type { Metadata } from "next";
import { Container, PageHeader } from "@/components/storefront/page-parts";
import { contactAction } from "../actions";
import { ContactForm } from "./contact-form";

export const metadata: Metadata = {
  title: "Contact",
  description: "Get in touch with ACRONOS about orders, products, wholesale, press or Acronos Lab.",
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <Container className="pb-24">
      <PageHeader eyebrow="Contact //" title="Contact" intro="Questions about an order, a product, wholesale, press or Acronos Lab. We reply by e-mail." />
      <div className="py-12">
        <ContactForm action={contactAction} />
      </div>
    </Container>
  );
}
