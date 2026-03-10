import { pgTable, uuid, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { onboardingPrograms } from "./onboarding_programs.js";

export const sponsorIntakes = pgTable(
  "sponsor_intakes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    onboardingProgramId: uuid("onboarding_program_id").notNull().references(() => onboardingPrograms.id).unique(),
    sponsorName: text("sponsor_name").notNull(),
    sponsorRole: text("sponsor_role").notNull(),
    currentPriorities: jsonb("current_priorities").$type<string[]>().notNull().default([]),
    targetDepartments: jsonb("target_departments").$type<string[]>().notNull().default([]),
    deploymentPace: text("deployment_pace"), // aggressive, moderate, conservative
    riskTolerance: text("risk_tolerance"), // high, medium, low
    currentAiUsage: jsonb("current_ai_usage").$type<string[]>().notNull().default([]),
    desiredOutcomes: jsonb("desired_outcomes").$type<string[]>().notNull().default([]),
    nonGoals: jsonb("non_goals").$type<string[]>().notNull().default([]),
    notes: text("notes"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    programIdx: index("sponsor_intakes_program_idx").on(table.onboardingProgramId),
  }),
);
