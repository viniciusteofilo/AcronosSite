ALTER TABLE "orders" ADD COLUMN "shipping_method" jsonb;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "country" char(2);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "payment_provider" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "provider_checkout_id" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "checkout_url" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "public_token" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "needs_attention" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "paid_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "canceled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_providerCheckoutId_unique" UNIQUE("provider_checkout_id");