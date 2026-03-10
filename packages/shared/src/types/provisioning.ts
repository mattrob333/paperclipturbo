export const PROVISIONING_PHASES = [
  "pending",
  "infra_check",
  "workspace_init",
  "runtime_attach",
  "workspace_verify",
  "generation",
  "activation",
] as const;

export type ProvisioningPhase = (typeof PROVISIONING_PHASES)[number];

export const PROVISIONING_JOB_STATUSES = ["queued", "running", "completed", "failed"] as const;
export type ProvisioningJobStatus = (typeof PROVISIONING_JOB_STATUSES)[number];

export const COMPANY_LIFECYCLE_STATUSES = [
  "draft",
  "provisioning",
  "active",
  "paused",
  "failed",
  "archived",
] as const;
export type CompanyLifecycleStatus = (typeof COMPANY_LIFECYCLE_STATUSES)[number];

export type RuntimeMode = "shared" | "dedicated" | "unknown";
export type ProvisioningMode = "cold_start" | "attach";

export interface ProvisioningLogEntry {
  ts: string;
  level: "info" | "warn" | "error";
  phase: ProvisioningPhase;
  message: string;
  detail?: string;
}

export interface ProvisioningJob {
  id: string;
  companyId: string;
  status: ProvisioningJobStatus;
  currentPhase: ProvisioningPhase;
  phaseProgress: number;
  errorMessage: string | null;
  errorPhase: string | null;
  log: ProvisioningLogEntry[];
  workspacePath: string | null;
  gatewayUrl: string | null;
  provisioningMode: ProvisioningMode;
  runtimeMode: RuntimeMode;
  retryCount: number;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProvisioningConfig {
  companyName: string;
  companyDescription?: string;
  workspaceRoot?: string;
  gatewayUrl?: string;
  anthropicApiKey?: string;
}

/** Phase metadata for UI display */
export const PROVISIONING_PHASE_LABELS: Record<ProvisioningPhase, string> = {
  pending: "Waiting to start",
  infra_check: "Checking infrastructure",
  workspace_init: "Initializing workspace",
  runtime_attach: "Attaching to OpenClaw Runtime",
  workspace_verify: "Verifying workspace",
  generation: "Generating workspace content",
  activation: "Activating company",
};

export const PROVISIONING_PHASE_DESCRIPTIONS: Record<ProvisioningPhase, string> = {
  pending: "The provisioning job is queued and waiting to start.",
  infra_check: "Verifying that the workspace root, OpenClaw template, and Anthropic credentials are available.",
  workspace_init: "Creating the company workspace from the OpenClaw baseline template.",
  runtime_attach: "Verifying the OpenClaw gateway is reachable and healthy. The gateway must be running before provisioning can continue.",
  workspace_verify: "Confirming the workspace files are visible and correctly structured.",
  generation: "Using Claude to generate role definitions, agent instructions, and workspace content.",
  activation: "Creating agents in Paperclip and marking the company as active.",
};

export interface ReadinessCheck {
  name: string;
  ok: boolean;
  message: string;
  detail?: string;
}

export interface InstanceReadiness {
  checks: ReadinessCheck[];
  overallStatus: "ready" | "degraded" | "not_ready";
  timestamp: string;
}
