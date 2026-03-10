import { pgTable, uuid, text, timestamp, index } from "drizzle-orm/pg-core";
import { onboardingPrograms } from "./onboarding_programs.js";

export const onboardingParticipants = pgTable(
  "onboarding_participants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    onboardingProgramId: uuid("onboarding_program_id").notNull().references(() => onboardingPrograms.id),
    name: text("name").notNull(),
    email: text("email").notNull(),
    title: text("title"),
    department: text("department"),
    managerParticipantId: uuid("manager_participant_id"),
    status: text("status").notNull().default("invited"), // invited, active, completed, declined
    invitedAt: timestamp("invited_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    programIdx: index("onboarding_participants_program_idx").on(table.onboardingProgramId),
    programStatusIdx: index("onboarding_participants_program_status_idx").on(table.onboardingProgramId, table.status),
  }),
);
