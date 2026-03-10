CREATE TABLE "build_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"onboarding_program_id" uuid NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"current_stage" text DEFAULT 'initializing' NOT NULL,
	"stage_progress" integer DEFAULT 0 NOT NULL,
	"agent_count" integer DEFAULT 0 NOT NULL,
	"file_count" integer DEFAULT 0 NOT NULL,
	"validation_passed" boolean,
	"error_message" text,
	"log" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "build_runs" ADD CONSTRAINT "build_runs_onboarding_program_id_onboarding_programs_id_fk" FOREIGN KEY ("onboarding_program_id") REFERENCES "public"."onboarding_programs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "build_runs_program_idx" ON "build_runs" USING btree ("onboarding_program_id");--> statement-breakpoint
CREATE INDEX "build_runs_status_idx" ON "build_runs" USING btree ("onboarding_program_id","status");
