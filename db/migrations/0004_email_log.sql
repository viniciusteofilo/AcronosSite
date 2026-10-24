CREATE TABLE "email_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"to" text NOT NULL,
	"subject" text NOT NULL,
	"status" text NOT NULL,
	"provider" text,
	"provider_id" text,
	"error" text,
	"ref" text,
	"body_html" text,
	"body_text" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "email_log_created_at_index" ON "email_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "email_log_to_index" ON "email_log" USING btree ("to");