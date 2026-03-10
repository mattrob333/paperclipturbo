import { z } from "zod";

export const provisionRequestSchema = z.object({
  companySlug: z.string().min(1),
  mode: z.enum(["new", "existing", "export_only"]),
  workspacePath: z.string().optional(),
  instanceName: z.string().optional(),
  environment: z.enum(["development", "staging", "production"]).optional(),
  heartbeatMode: z.enum(["on-demand", "scheduled", "continuous"]).optional(),
  fileSyncMode: z.enum(["manual", "auto", "watch"]).optional(),
});

export type ProvisionRequestInput = z.infer<typeof provisionRequestSchema>;

export const validateConnectionSchema = z.object({
  companySlug: z.string().min(1),
  workspacePath: z.string().min(1),
});

export type ValidateConnectionInput = z.infer<typeof validateConnectionSchema>;

export const syncRequestSchema = z.object({
  companySlug: z.string().min(1),
  direction: z.enum(["blueprint_to_runtime", "runtime_to_blueprint"]).optional(),
});

export type SyncRequestInput = z.infer<typeof syncRequestSchema>;
