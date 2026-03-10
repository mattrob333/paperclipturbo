CREATE TABLE IF NOT EXISTS "provisioning_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"status" text NOT NULL DEFAULT 'queued',
	"current_phase" text NOT NULL DEFAULT 'pending',
	"phase_progress" integer NOT NULL DEFAULT 0,
	"error_message" text,
	"error_phase" text,
	"log" jsonb NOT NULL DEFAULT '[]'::jsonb,
	"workspace_path" text,
	"gateway_url" text,
	"retry_count" integer NOT NULL DEFAULT 0,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "provisioning_jobs" ADD CONSTRAINT "provisioning_jobs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "provisioning_jobs_company_idx" ON "provisioning_jobs" ("company_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "provisioning_jobs_status_idx" ON "provisioning_jobs" ("company_id", "status");
