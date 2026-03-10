import { pgTable, uuid, text, timestamp, integer, index } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";

export const onboardingPrograms = pgTable(
  "onboarding_programs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    status: text("status").notNull().default("draft"), // draft, intake, discovery, synthesis, proposal, approved, provisioning, complete
    phase: text("phase").notNull().default("sponsor_intake"), // sponsor_intake, participant_invite, discovery, synthesis, workshop, proposal, provisioning
    title: text("title"),
    schemaVersion: integer("schema_version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyIdx: index("onboarding_programs_company_idx").on(table.companyId),
    statusIdx: index("onboarding_programs_status_idx").on(table.status),
  }),
);
