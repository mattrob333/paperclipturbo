import { pgTable, uuid, text, timestamp, jsonb, real, index, uniqueIndex } from "drizzle-orm/pg-core";
import { onboardingParticipants } from "./onboarding_participants.js";
import { discoveryQuestions } from "./discovery_questions.js";

export const discoveryResponses = pgTable(
  "discovery_responses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    participantId: uuid("participant_id").notNull().references(() => onboardingParticipants.id),
    questionId: uuid("question_id").notNull().references(() => discoveryQuestions.id),
    rawText: text("raw_text").notNull(),
    normalizedTags: jsonb("normalized_tags").$type<string[]>().notNull().default([]),
    inferredCapabilities: jsonb("inferred_capabilities").$type<string[]>().notNull().default([]),
    inferredTaskTypes: jsonb("inferred_task_types").$type<string[]>().notNull().default([]),
    inferredDependencies: jsonb("inferred_dependencies").$type<string[]>().notNull().default([]),
    sentiment: text("sentiment"), // positive, neutral, negative, mixed
    confidence: real("confidence"), // 0.0 - 1.0
    evidenceRefs: jsonb("evidence_refs").$type<string[]>().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    participantIdx: index("discovery_responses_participant_idx").on(table.participantId),
    questionIdx: index("discovery_responses_question_idx").on(table.questionId),
    participantQuestionUniqueIdx: uniqueIndex("discovery_responses_participant_question_idx").on(table.participantId, table.questionId),
  }),
);
