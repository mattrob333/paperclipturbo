import { pgTable, uuid, text, integer, boolean, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { onboardingPrograms } from "./onboarding_programs.js";

export const discoveryQuestions = pgTable(
  "discovery_questions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    onboardingProgramId: uuid("onboarding_program_id").notNull().references(() => onboardingPrograms.id),
    bucket: text("bucket").notNull(), // role_and_responsibilities, daily_workflow, collaboration, pain_points, ai_readiness
    prompt: text("prompt").notNull(),
    inputType: text("input_type").notNull().default("textarea"), // text, textarea, select
    required: boolean("required").notNull().default(true),
    sequence: integer("sequence").notNull(),
    followupRules: jsonb("followup_rules").$type<Record<string, unknown>[]>().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    programBucketIdx: index("discovery_questions_program_bucket_idx").on(table.onboardingProgramId, table.bucket),
    programSequenceIdx: index("discovery_questions_program_sequence_idx").on(table.onboardingProgramId, table.sequence),
  }),
);
