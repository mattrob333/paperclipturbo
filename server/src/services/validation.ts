import fs from "node:fs/promises";
import path from "node:path";
import { and, desc, eq } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import {
  agents,
  agentRuntimeState,
  heartbeatRuns,
} from "@paperclipai/db";
import type { ValidationItem } from "@paperclipai/shared";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

/**
 * Guard against path traversal by ensuring the resolved path is inside the
 * expected root directory.
 */
function isSafePath(candidate: string, root: string): boolean {
  const resolved = path.resolve(candidate);
  const resolvedRoot = path.resolve(root);
  return resolved.startsWith(resolvedRoot + path.sep) || resolved === resolvedRoot;
}

export function validationService(db: Db) {
  async function validateAgent(
    companyId: string,
    agentId: string,
  ): Promise<ValidationItem[]> {
    const agent = await db
      .select()
      .from(agents)
      .where(and(eq(agents.id, agentId), eq(agents.companyId, companyId)))
      .then((rows) => rows[0] ?? null);

    if (!agent) return [];

    const items: ValidationItem[] = [];

    // 1. Check adapter configured
    if (!agent.adapterType || agent.adapterType === "process") {
      items.push({
        rule: "adapter_configured",
        severity: "error",
        message: "No adapter configured for this agent",
        affectedFiles: [],
        suggestedFix: "Configure an adapter type (e.g. claude_local) in agent settings",
      });
    }

    // 2. Check workspace / cwd
    const adapterConfig = asRecord(agent.adapterConfig) ?? {};
    const cwd = asString(adapterConfig.cwd);

    if (!cwd) {
      items.push({
        rule: "workspace_configured",
        severity: "warning",
        message: "No workspace path configured",
        affectedFiles: [],
        suggestedFix: "Set adapterConfig.cwd to the agent's working directory",
      });
    } else {
      // 3. Check workspace exists
      try {
        const stat = await fs.stat(cwd);
        if (!stat.isDirectory()) {
          items.push({
            rule: "workspace_exists",
            severity: "error",
            message: `Workspace path '${cwd}' exists but is not a directory`,
            affectedFiles: [],
            suggestedFix: "Update workspace path to point to a directory",
          });
        } else {
          // 4. Check for expected files
          const expectedFiles = ["SOUL.md", "AGENTS.md"];
          for (const fileName of expectedFiles) {
            const filePath = path.join(cwd, fileName);
            if (!isSafePath(filePath, cwd)) continue;
            try {
              await fs.access(filePath);
            } catch {
              items.push({
                rule: "expected_file_present",
                severity: "warning",
                message: `Expected file '${fileName}' not found in workspace`,
                affectedFiles: [fileName],
                suggestedFix: `Create ${fileName} in the workspace directory`,
              });
            }
          }
        }
      } catch {
        items.push({
          rule: "workspace_exists",
          severity: "error",
          message: `Workspace path '${cwd}' does not exist`,
          affectedFiles: [],
          suggestedFix: "Update workspace path in agent settings or create the directory",
        });
      }
    }

    // 5. Check instructions file path
    const instructionsFilePath = asString(adapterConfig.instructionsFilePath);
    if (instructionsFilePath) {
      try {
        await fs.access(instructionsFilePath);
      } catch {
        items.push({
          rule: "instructions_file_exists",
          severity: "warning",
          message: `Instructions file '${instructionsFilePath}' not found`,
          affectedFiles: [instructionsFilePath],
          suggestedFix: "Ensure the instructions file path is correct and the file exists",
        });
      }
    }

    // 6. Check for secret bindings
    const runtimeConfig = asRecord(agent.runtimeConfig) ?? {};
    const envConfig = asRecord(runtimeConfig.env);
    const hasEnvBindings = envConfig && Object.keys(envConfig).length > 0;
    if (!hasEnvBindings) {
      items.push({
        rule: "secret_bindings",
        severity: "info",
        message: "No environment variable bindings configured",
        affectedFiles: [],
        suggestedFix: "Add secret bindings in runtimeConfig.env if the agent needs API keys",
      });
    }

    // 7. Check last heartbeat age
    if (agent.lastHeartbeatAt) {
      const ageMs = Date.now() - new Date(agent.lastHeartbeatAt).getTime();
      const oneHourMs = 60 * 60 * 1000;
      if (ageMs > oneHourMs) {
        const ageMinutes = Math.round(ageMs / 60000);
        items.push({
          rule: "heartbeat_stale",
          severity: "warning",
          message: `Last heartbeat was ${ageMinutes} minutes ago`,
          affectedFiles: [],
          suggestedFix: "Check if the agent heartbeat scheduler is running",
        });
      }
    }

    // 8. Check runtime state for last error
    const runtimeState = await db
      .select()
      .from(agentRuntimeState)
      .where(eq(agentRuntimeState.agentId, agentId))
      .then((rows) => rows[0] ?? null);

    if (runtimeState?.lastError) {
      items.push({
        rule: "last_run_error",
        severity: "warning",
        message: `Last run ended with error: ${runtimeState.lastError}`,
        affectedFiles: [],
        suggestedFix: "Review the last run logs for details",
      });
    }

    // 9. Check last heartbeat run status
    const lastRun = await db
      .select({
        id: heartbeatRuns.id,
        status: heartbeatRuns.status,
        error: heartbeatRuns.error,
      })
      .from(heartbeatRuns)
      .where(and(eq(heartbeatRuns.agentId, agentId), eq(heartbeatRuns.companyId, companyId)))
      .orderBy(desc(heartbeatRuns.createdAt))
      .limit(1)
      .then((rows) => rows[0] ?? null);

    if (lastRun?.status === "failed" || lastRun?.status === "timed_out") {
      items.push({
        rule: "last_run_status",
        severity: "error",
        message: `Last run ${lastRun.status}: ${lastRun.error ?? "unknown error"}`,
        affectedFiles: [],
        suggestedFix: "Review the run logs and fix the underlying issue",
      });
    }

    // 10. Check config completeness
    if (!agent.name || agent.name.trim().length === 0) {
      items.push({
        rule: "config_complete",
        severity: "error",
        message: "Agent name is missing",
        affectedFiles: [],
        suggestedFix: "Set a name for this agent",
      });
    }

    if (!agent.role || agent.role.trim().length === 0) {
      items.push({
        rule: "config_complete",
        severity: "error",
        message: "Agent role is missing",
        affectedFiles: [],
        suggestedFix: "Set a role for this agent",
      });
    }

    // 11. Agent status check
    if (agent.status === "paused") {
      items.push({
        rule: "agent_active",
        severity: "warning",
        message: "Agent is currently paused",
        affectedFiles: [],
        suggestedFix: "Resume the agent if it should be running",
      });
    } else if (agent.status === "error") {
      items.push({
        rule: "agent_active",
        severity: "error",
        message: "Agent is in error state",
        affectedFiles: [],
        suggestedFix: "Check agent logs and resolve the error",
      });
    }

    return items;
  }

  return {
    validateAgent,
  };
}
