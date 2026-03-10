CREATE TABLE "onboarding_programs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"phase" text DEFAULT 'sponsor_intake' NOT NULL,
	"title" text,
	"schema_version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sponsor_intakes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"onboarding_program_id" uuid NOT NULL,
	"sponsor_name" text NOT NULL,
	"sponsor_role" text NOT NULL,
	"current_priorities" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"target_departments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"deployment_pace" text,
	"risk_tolerance" text,
	"current_ai_usage" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"desired_outcomes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"non_goals" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"notes" text,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "onboarding_participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"onboarding_program_id" uuid NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"title" text,
	"department" text,
	"manager_participant_id" uuid,
	"status" text DEFAULT 'invited' NOT NULL,
	"invited_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "discovery_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"onboarding_program_id" uuid NOT NULL,
	"bucket" text NOT NULL,
	"prompt" text NOT NULL,
	"input_type" text DEFAULT 'textarea' NOT NULL,
	"required" boolean DEFAULT true NOT NULL,
	"sequence" integer NOT NULL,
	"followup_rules" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "discovery_responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"participant_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"raw_text" text NOT NULL,
	"normalized_tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"inferred_capabilities" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"inferred_task_types" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"inferred_dependencies" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sentiment" text,
	"confidence" real,
	"evidence_refs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "synthesis_artifacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"onboarding_program_id" uuid NOT NULL,
	"artifact_type" text NOT NULL,
	"title" text NOT NULL,
	"summary" text,
	"payload_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"confidence_summary" real,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "onboarding_proposals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"onboarding_program_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"top_findings" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"hybrid_org_summary" text,
	"proposed_agent_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"pairing_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"rollout_phase_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"human_led_boundaries" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"revision_notes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "onboarding_programs" ADD CONSTRAINT "onboarding_programs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sponsor_intakes" ADD CONSTRAINT "sponsor_intakes_onboarding_program_id_onboarding_programs_id_fk" FOREIGN KEY ("onboarding_program_id") REFERENCES "public"."onboarding_programs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_participants" ADD CONSTRAINT "onboarding_participants_onboarding_program_id_onboarding_programs_id_fk" FOREIGN KEY ("onboarding_program_id") REFERENCES "public"."onboarding_programs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discovery_questions" ADD CONSTRAINT "discovery_questions_onboarding_program_id_onboarding_programs_id_fk" FOREIGN KEY ("onboarding_program_id") REFERENCES "public"."onboarding_programs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discovery_responses" ADD CONSTRAINT "discovery_responses_participant_id_onboarding_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."onboarding_participants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discovery_responses" ADD CONSTRAINT "discovery_responses_question_id_discovery_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."discovery_questions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "synthesis_artifacts" ADD CONSTRAINT "synthesis_artifacts_onboarding_program_id_onboarding_programs_id_fk" FOREIGN KEY ("onboarding_program_id") REFERENCES "public"."onboarding_programs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_proposals" ADD CONSTRAINT "onboarding_proposals_onboarding_program_id_onboarding_programs_id_fk" FOREIGN KEY ("onboarding_program_id") REFERENCES "public"."onboarding_programs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "onboarding_programs_company_idx" ON "onboarding_programs" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "onboarding_programs_status_idx" ON "onboarding_programs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "sponsor_intakes_program_idx" ON "sponsor_intakes" USING btree ("onboarding_program_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sponsor_intakes_onboarding_program_id_unique" ON "sponsor_intakes" USING btree ("onboarding_program_id");--> statement-breakpoint
CREATE INDEX "onboarding_participants_program_idx" ON "onboarding_participants" USING btree ("onboarding_program_id");--> statement-breakpoint
CREATE INDEX "onboarding_participants_program_status_idx" ON "onboarding_participants" USING btree ("onboarding_program_id","status");--> statement-breakpoint
CREATE INDEX "discovery_questions_program_bucket_idx" ON "discovery_questions" USING btree ("onboarding_program_id","bucket");--> statement-breakpoint
CREATE INDEX "discovery_questions_program_sequence_idx" ON "discovery_questions" USING btree ("onboarding_program_id","sequence");--> statement-breakpoint
CREATE INDEX "discovery_responses_participant_idx" ON "discovery_responses" USING btree ("participant_id");--> statement-breakpoint
CREATE INDEX "discovery_responses_question_idx" ON "discovery_responses" USING btree ("question_id");--> statement-breakpoint
CREATE UNIQUE INDEX "discovery_responses_participant_question_idx" ON "discovery_responses" USING btree ("participant_id","question_id");--> statement-breakpoint
CREATE INDEX "synthesis_artifacts_program_idx" ON "synthesis_artifacts" USING btree ("onboarding_program_id");--> statement-breakpoint
CREATE INDEX "synthesis_artifacts_program_type_idx" ON "synthesis_artifacts" USING btree ("onboarding_program_id","artifact_type");--> statement-breakpoint
CREATE INDEX "onboarding_proposals_program_idx" ON "onboarding_proposals" USING btree ("onboarding_program_id");--> statement-breakpoint
CREATE INDEX "onboarding_proposals_program_status_idx" ON "onboarding_proposals" USING btree ("onboarding_program_id","status");