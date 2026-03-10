import { z } from "zod";
import { PROVISIONING_PHASES, PROVISIONING_JOB_STATUSES, COMPANY_LIFECYCLE_STATUSES } from "../types/provisioning.js";

export const startProvisioningSchema = z.object({
  companyName: z.string().min(1).max(200),
  companyDescription: z.string().max(2000).optional(),
  workspaceRoot: z.string().optional(),
  gatewayUrl: z.string().url().optional(),
});

export const retryProvisioningSchema = z.object({
  fromPhase: z.enum(PROVISIONING_PHASES).optional(),
});

export type StartProvisioningInput = z.infer<typeof startProvisioningSchema>;
export type RetryProvisioningInput = z.infer<typeof retryProvisioningSchema>;
