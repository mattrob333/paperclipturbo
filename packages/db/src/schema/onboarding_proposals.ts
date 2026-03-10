import { pgTable, uuid, text, integer, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { onboardingPrograms } from "./onboarding_programs.js";

export const onboardingProposals = pgTable(
  "onboarding_proposals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    onboardingProgramId: uuid("onboarding_program_id").notNull().references(() => onboardingPrograms.id),
    version: integer("version").notNull().default(1),
    status: text("status").notNull().default("draft"), // draft, pending_review, findings_approved, org_approved, provisioning_approved, revision_requested
    topFindings: jsonb("top_findings").$type<string[]>().notNull().default([]),
    hybridOrgSummary: text("hybrid_org_summary"),
    proposedAgentIds: jsonb("proposed_agent_ids").$type<string[]>().notNull().default([]),
    pairingIds: jsonb("pairing_ids").$type<string[]>().notNull().default([]),
    rolloutPhaseIds: jsonb("rollout_phase_ids").$type<string[]>().notNull().default([]),
    humanLedBoundaries: jsonb("human_led_boundaries").$type<string[]>().notNull().default([]),
    revisionNotes: jsonb("revision_notes").$type<string[]>().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    programIdx: index("onboarding_proposals_program_idx").on(table.onboardingProgramId),
    programStatusIdx: index("onboarding_proposals_program_status_idx").on(table.onboardingProgramId, table.status),
  }),
);
