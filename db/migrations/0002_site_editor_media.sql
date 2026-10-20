CREATE TABLE "support_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"topic" text NOT NULL,
	"message" text NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pages" ALTER COLUMN "blocks" SET DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "media_assets" ADD COLUMN "renditions" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "media_assets" ADD COLUMN "original_name" text;--> statement-breakpoint
ALTER TABLE "media_assets" ADD COLUMN "focal_x" numeric(4, 3) DEFAULT '0.5' NOT NULL;--> statement-breakpoint
ALTER TABLE "media_assets" ADD COLUMN "focal_y" numeric(4, 3) DEFAULT '0.5' NOT NULL;--> statement-breakpoint
ALTER TABLE "product_variants" ADD COLUMN "color_hex" char(7);--> statement-breakpoint
ALTER TABLE "pages" ADD COLUMN "draft_blocks" jsonb;--> statement-breakpoint
ALTER TABLE "pages" ADD COLUMN "scheduled_blocks" jsonb;--> statement-breakpoint
ALTER TABLE "pages" ADD COLUMN "scheduled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "pages" ADD COLUMN "updated_by" uuid;--> statement-breakpoint
ALTER TABLE "support_requests" ADD CONSTRAINT "support_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pages" ADD CONSTRAINT "pages_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;