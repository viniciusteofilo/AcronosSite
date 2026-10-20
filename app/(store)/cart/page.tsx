import type { Metadata } from "next";
import { Container, EmptyState, PageHeader } from "@/components/storefront/page-parts";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = { title: "Cart", robots: { index: false } };

/** Cart and checkout arrive in Phase 05 (Stripe and PayPal). Until then the page says so plainly. */
export default function CartPage() {
  return (
    <Container className="pb-24">
      <PageHeader eyebrow="Cart //" title="Your cart" />
      <div className="py-10">
        <EmptyState title="Your cart is empty" text="Online orders open with the store launch.">
          <ButtonLink href="/shop" variant="secondary" size="sm">
            Browse the shop
          </ButtonLink>
        </EmptyState>
      </div>
    </Container>
  );
}
