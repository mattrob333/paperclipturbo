import { pgTable, uuid, text, integer, boolean, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { onboardingPrograms } from "./onboarding_programs.js";

export const buildRuns = pgTable(
  "build_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    onboardingProgramId: uuid("onboarding_program_id").notNull().references(() => onboardingPrograms.id),
    status: text("status").notNull().default("queued"),
    currentStage: text("current_stage").notNull().default("initializing"),
    stageProgress: integer("stage_progress").notNull().default(0),
    agentCount: integer("agent_count").notNull().default(0),
    fileCount: integer("file_count").notNull().default(0),
    validationPassed: boolean("validation_passed"),
    errorMessage: text("error_message"),
    log: jsonb("log").$type<Record<string, unknown>[]>().notNull().default([]),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    programIdx: index("build_runs_program_idx").on(table.onboardingProgramId),
    statusIdx: index("build_runs_status_idx").on(table.onboardingProgramId, table.status),
  }),
);
