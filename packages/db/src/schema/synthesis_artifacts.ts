import { pgTable, uuid, text, timestamp, jsonb, real, index } from "drizzle-orm/pg-core";
import { onboardingPrograms } from "./onboarding_programs.js";

export const synthesisArtifacts = pgTable(
  "synthesis_artifacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    onboardingProgramId: uuid("onboarding_program_id").notNull().references(() => onboardingPrograms.id),
    artifactType: text("artifact_type").notNull(), // theme_summary, contradiction_report, workflow_map, bottleneck_analysis, opportunity_assessment, full_synthesis
    title: text("title").notNull(),
    summary: text("summary"),
    payloadJson: jsonb("payload_json").$type<Record<string, unknown>>().notNull().default({}),
    confidenceSummary: real("confidence_summary"),
    generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    programIdx: index("synthesis_artifacts_program_idx").on(table.onboardingProgramId),
    programTypeIdx: index("synthesis_artifacts_program_type_idx").on(table.onboardingProgramId, table.artifactType),
  }),
);
