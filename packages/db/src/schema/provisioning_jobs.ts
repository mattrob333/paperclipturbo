import { pgTable, uuid, text, integer, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";

export const provisioningJobs = pgTable(
  "provisioning_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    status: text("status").notNull().default("queued"),
    // queued | running | completed | failed
    currentPhase: text("current_phase").notNull().default("pending"),
    // pending | infra_check | workspace_init | runtime_attach | workspace_verify | generation | activation
    phaseProgress: integer("phase_progress").notNull().default(0),
    errorMessage: text("error_message"),
    errorPhase: text("error_phase"),
    log: jsonb("log").$type<{ ts: string; level: string; phase: string; message: string; detail?: string }[]>().notNull().default([]),
    workspacePath: text("workspace_path"),
    gatewayUrl: text("gateway_url"),
    provisioningMode: text("provisioning_mode").notNull().default("cold_start"),
    // cold_start | attach
    runtimeMode: text("runtime_mode").notNull().default("shared"),
    // shared | dedicated | unknown
    retryCount: integer("retry_count").notNull().default(0),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyIdx: index("provisioning_jobs_company_idx").on(table.companyId),
    statusIdx: index("provisioning_jobs_status_idx").on(table.companyId, table.status),
  }),
);
