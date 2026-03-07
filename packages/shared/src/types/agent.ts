import type {
  AgentAdapterType,
  AgentRole,
  AgentStatus,
} from "../constants.js";

export interface AgentPermissions {
  canCreateAgents: boolean;
}

export interface Agent {
  id: string;
  companyId: string;
  name: string;
  urlKey: string;
  role: AgentRole;
  title: string | null;
  icon: string | null;
  status: AgentStatus;
  reportsTo: string | null;
  capabilities: string | null;
  adapterType: AgentAdapterType;
  adapterConfig: Record<string, unknown>;
  runtimeConfig: Record<string, unknown>;
  budgetMonthlyCents: number;
  spentMonthlyCents: number;
  permissions: AgentPermissions;
  lastHeartbeatAt: Date | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentKeyCreated {
  id: string;
  name: string;
  token: string;
  createdAt: Date;
}

export interface AgentConfigRevision {
  id: string;
  companyId: string;
  agentId: string;
  createdByAgentId: string | null;
  createdByUserId: string | null;
  source: string;
  rolledBackFromRevisionId: string | null;
  changedKeys: string[];
  beforeConfig: Record<string, unknown>;
  afterConfig: Record<string, unknown>;
  createdAt: Date;
}

export type AdapterEnvironmentCheckLevel = "info" | "warn" | "error";
export type AdapterEnvironmentTestStatus = "pass" | "warn" | "fail";

export interface AdapterEnvironmentCheck {
  code: string;
  level: AdapterEnvironmentCheckLevel;
  message: string;
  detail?: string | null;
  hint?: string | null;
}

export interface AdapterEnvironmentTestResult {
  adapterType: string;
  status: AdapterEnvironmentTestStatus;
  checks: AdapterEnvironmentCheck[];
  testedAt: string;
}

// -- Agent setup state --

export const AGENT_SETUP_STATES = [
  "not_configured",
  "credentials_missing",
  "environment_test_failed",
  "configured_unverified",
  "verified",
  "runtime_unavailable",
  "healthy",
] as const;
export type AgentSetupState = (typeof AGENT_SETUP_STATES)[number];

export interface AgentSetupStateInfo {
  state: AgentSetupState;
  label: string;
  actionHint: string | null;
}

const SETUP_STATE_LABELS: Record<AgentSetupState, string> = {
  not_configured: "Not Configured",
  credentials_missing: "Credentials Missing",
  environment_test_failed: "Env Test Failed",
  configured_unverified: "Unverified",
  verified: "Verified",
  runtime_unavailable: "Runtime Unavailable",
  healthy: "Healthy",
};

const SETUP_STATE_HINTS: Record<AgentSetupState, string | null> = {
  not_configured: "Configure adapter settings",
  credentials_missing: "Add required credentials or secrets",
  environment_test_failed: "Fix environment issues and re-test",
  configured_unverified: "Run an environment test to verify",
  verified: "Ready to run",
  runtime_unavailable: "Check adapter availability",
  healthy: null,
};

/**
 * Derives the agent setup state from agent data and optional runtime/heartbeat info.
 * This is a pure function usable on both client and server.
 */
export function deriveAgentSetupState(input: {
  agent: Agent;
  runtimeState?: { lastRunStatus?: string | null; lastError?: string | null } | null;
  lastEnvTestResult?: AdapterEnvironmentTestResult | null;
  lastHeartbeatAt?: Date | string | null;
}): AgentSetupStateInfo {
  const { agent, runtimeState, lastEnvTestResult, lastHeartbeatAt } = input;

  // Terminal / special statuses
  if (agent.status === "terminated" || agent.status === "pending_approval") {
    return info("not_configured");
  }

  const config = agent.adapterConfig ?? {};
  const isLocal =
    agent.adapterType === "claude_local" ||
    agent.adapterType === "codex_local" ||
    agent.adapterType === "opencode_local" ||
    agent.adapterType === "cursor";

  // Check if adapter config is essentially empty
  const configKeys = Object.keys(config);
  const hasAdapterConfig = configKeys.length > 0;

  if (!hasAdapterConfig && isLocal) {
    return info("not_configured");
  }

  // Check for missing cwd on local adapters
  if (isLocal) {
    const cwd = typeof config.cwd === "string" ? config.cwd.trim() : "";
    if (!cwd) {
      return info("not_configured");
    }
  }

  // If we have env test result, check its status
  if (lastEnvTestResult) {
    if (lastEnvTestResult.status === "fail") {
      // Check if it's a credentials issue
      const hasCredentialIssue = lastEnvTestResult.checks.some(
        (c) =>
          c.level === "error" &&
          (c.code.includes("auth") ||
            c.code.includes("credential") ||
            c.code.includes("api_key") ||
            c.code.includes("login")),
      );
      if (hasCredentialIssue) {
        return info("credentials_missing");
      }
      return info("environment_test_failed");
    }
  }

  // Check runtime state for issues
  if (runtimeState?.lastError && runtimeState.lastRunStatus === "failed") {
    const errorLower = (runtimeState.lastError ?? "").toLowerCase();
    if (
      errorLower.includes("not found") ||
      errorLower.includes("enoent") ||
      errorLower.includes("spawn") ||
      errorLower.includes("process lost")
    ) {
      return info("runtime_unavailable");
    }
  }

  // Agent has run successfully before
  const heartbeatTime = lastHeartbeatAt ?? agent.lastHeartbeatAt;
  const hasRunBefore = Boolean(heartbeatTime);

  if (hasRunBefore && (agent.status === "idle" || agent.status === "running" || agent.status === "active")) {
    // Check heartbeat recency (stale if > 2x interval or > 24h with no interval)
    const runtimeConfig = (agent.runtimeConfig ?? {}) as Record<string, unknown>;
    const heartbeatConfig = (runtimeConfig.heartbeat ?? {}) as Record<string, unknown>;
    const intervalSec = typeof heartbeatConfig.intervalSec === "number" ? heartbeatConfig.intervalSec : 0;

    if (heartbeatTime && intervalSec > 0) {
      const lastBeat = typeof heartbeatTime === "string" ? new Date(heartbeatTime) : heartbeatTime;
      const staleSec = intervalSec * 3;
      const elapsed = (Date.now() - lastBeat.getTime()) / 1000;
      if (elapsed > staleSec) {
        return info("runtime_unavailable");
      }
    }

    return info("healthy");
  }

  // Env test passed
  if (lastEnvTestResult && (lastEnvTestResult.status === "pass" || lastEnvTestResult.status === "warn")) {
    return info("verified");
  }

  // Has config but no env test result
  if (hasAdapterConfig) {
    return info("configured_unverified");
  }

  return info("not_configured");
}

function info(state: AgentSetupState): AgentSetupStateInfo {
  return {
    state,
    label: SETUP_STATE_LABELS[state],
    actionHint: SETUP_STATE_HINTS[state],
  };
}
