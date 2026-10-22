CREATE TABLE "scroll_sequences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"frame_count" integer NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"mobile_width" integer NOT NULL,
	"mobile_height" integer NOT NULL,
	"original_name" text,
	"status" text DEFAULT 'uploading' NOT NULL,
	"total_bytes" integer DEFAULT 0 NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "scroll_sequences" ADD CONSTRAINT "scroll_sequences_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;