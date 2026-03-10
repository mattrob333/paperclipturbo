import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import type {
  DiscoveryResult,
  DiscoveredAgent,
  DiscoveredFile,
} from "@paperclipai/shared";

const CONFIG_FILENAME = "openclaw-agents-config.json";

const REQUIRED_FILES = ["SOUL.md", "AGENTS.md", "IDENTITY.md"] as const;
const OPTIONAL_FILES = ["TOOLS.md", "MEMORY.md", "HEARTBEAT.md"] as const;
const ALL_EXPECTED_FILES = [...REQUIRED_FILES, ...OPTIONAL_FILES];

/**
 * Extract the agents array from the parsed config, handling both
 * `config.agents` (array) and `config.agents.list` (array) formats.
 */
function extractAgentList(
  config: Record<string, unknown>,
): Array<{ role?: string; name?: string; folder?: string }> {
  const agents = config.agents;
  if (Array.isArray(agents)) {
    return agents;
  }
  if (agents && typeof agents === "object" && "list" in agents) {
    const list = (agents as Record<string, unknown>).list;
    if (Array.isArray(list)) {
      return list;
    }
  }
  return [];
}

/**
 * Determine agent status based on which required files exist.
 */
function deriveAgentStatus(
  files: DiscoveredFile[],
  folderExists: boolean,
): DiscoveredAgent["status"] {
  if (!folderExists) return "missing";
  const requiredPresent = REQUIRED_FILES.every((name) => {
    const f = files.find((df) => df.name === name);
    return f?.exists;
  });
  return requiredPresent ? "complete" : "partial";
}

export function workspaceDiscoveryService() {
  /**
   * Discover an existing OpenClaw workspace.
   * Scans the given path for openclaw-agents-config.json and enumerates agent folders.
   * Does NOT modify any files or create any DB records.
   */
  async function discoverWorkspace(
    workspacePath: string,
  ): Promise<DiscoveryResult> {
    const issues: string[] = [];
    const agents: DiscoveredAgent[] = [];

    // 1. Check if the workspace path exists as a directory
    let dirExists = false;
    try {
      const stat = await fsp.stat(workspacePath);
      dirExists = stat.isDirectory();
      if (!dirExists) {
        issues.push(`Path exists but is not a directory: ${workspacePath}`);
      }
    } catch {
      issues.push(`Workspace path does not exist: ${workspacePath}`);
    }

    if (!dirExists) {
      return {
        workspacePath,
        gatewayUrl: "",
        gatewayHealthy: false,
        configFound: false,
        agents: [],
        overallStatus: "invalid",
        issues,
      };
    }

    // 2. Check if config file exists
    const configPath = path.join(workspacePath, CONFIG_FILENAME);
    let configFound = false;
    let configContent: string | null = null;

    try {
      configContent = await fsp.readFile(configPath, "utf-8");
      configFound = true;
    } catch {
      issues.push(
        `Config file not found: ${CONFIG_FILENAME}`,
      );
    }

    // 3. Parse the config
    let config: Record<string, unknown> | null = null;
    if (configContent !== null) {
      try {
        config = JSON.parse(configContent) as Record<string, unknown>;
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : String(err);
        issues.push(`Failed to parse ${CONFIG_FILENAME}: ${msg}`);
      }
    }

    if (!configFound || config === null) {
      return {
        workspacePath,
        gatewayUrl: "",
        gatewayHealthy: false,
        configFound,
        configPath: configFound ? configPath : undefined,
        agents: [],
        overallStatus: "invalid",
        issues,
      };
    }

    // Extract metadata from config
    const workspaceVersion =
      typeof config.version === "string" ? config.version : undefined;
    const workspaceName =
      typeof config.workspace === "string"
        ? config.workspace
        : typeof (config.workspace as Record<string, unknown>)?.name ===
            "string"
          ? (config.workspace as Record<string, unknown>).name as string
          : undefined;

    // 4. Extract agent definitions
    const agentDefs = extractAgentList(config);

    if (agentDefs.length === 0) {
      issues.push(
        "No agents found in config (checked agents[] and agents.list[])",
      );
    }

    // 5-7. Check each agent's folder and files
    for (const def of agentDefs) {
      const folder = def.folder ?? "";
      const role = def.role ?? "unknown";
      const name = def.name ?? folder;

      if (!folder) {
        issues.push(
          `Agent "${name}" has no folder specified in config`,
        );
        agents.push({
          name,
          role,
          folder: "",
          files: [],
          status: "missing",
        });
        continue;
      }

      const agentDir = path.join(workspacePath, folder);
      let folderExists = false;

      try {
        const stat = await fsp.stat(agentDir);
        folderExists = stat.isDirectory();
        if (!folderExists) {
          issues.push(
            `Agent "${name}" folder path exists but is not a directory: ${folder}`,
          );
        }
      } catch {
        issues.push(`Agent "${name}" folder not found: ${folder}`);
      }

      // Check each expected file
      const files: DiscoveredFile[] = [];
      for (const fileName of ALL_EXPECTED_FILES) {
        const filePath = path.join(agentDir, fileName);
        let exists = false;
        let sizeBytes: number | undefined;

        if (folderExists) {
          try {
            const fileStat = await fsp.stat(filePath);
            exists = fileStat.isFile();
            if (exists) {
              sizeBytes = fileStat.size;
            }
          } catch {
            // File doesn't exist
          }
        }

        files.push({
          name: fileName,
          exists,
          sizeBytes: exists ? sizeBytes : undefined,
        });
      }

      const status = deriveAgentStatus(files, folderExists);
      if (status === "partial") {
        const missing = REQUIRED_FILES.filter((f) => {
          const df = files.find((x) => x.name === f);
          return !df?.exists;
        });
        issues.push(
          `Agent "${name}" is missing required files: ${missing.join(", ")}`,
        );
      }

      agents.push({ name, role, folder, files, status });
    }

    // 8. Determine overall status
    let overallStatus: DiscoveryResult["overallStatus"];
    if (
      agents.length > 0 &&
      agents.every((a) => a.status === "complete")
    ) {
      overallStatus = "ready";
    } else if (agents.length === 0) {
      overallStatus = "incomplete";
    } else if (agents.some((a) => a.status === "missing")) {
      overallStatus = "incomplete";
    } else if (agents.some((a) => a.status === "partial")) {
      overallStatus = "incomplete";
    } else {
      overallStatus = "ready";
    }

    return {
      workspacePath,
      gatewayUrl: "",
      gatewayHealthy: false,
      configFound: true,
      configPath,
      agents,
      workspaceVersion,
      workspaceName,
      overallStatus,
      issues,
    };
  }

  /**
   * Check if a gateway URL is reachable and healthy.
   * Returns { healthy: boolean, error?: string }.
   */
  async function checkGateway(
    gatewayUrl: string,
  ): Promise<{ healthy: boolean; error?: string }> {
    // Derive health URL: replace /v1/responses suffix with /health, else append /health
    let healthUrl: string;
    const trimmed = gatewayUrl.replace(/\/+$/, "");
    if (trimmed.endsWith("/v1/responses")) {
      healthUrl =
        trimmed.slice(0, trimmed.length - "/v1/responses".length) + "/health";
    } else {
      healthUrl = trimmed + "/health";
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    try {
      const response = await fetch(healthUrl, {
        method: "GET",
        signal: controller.signal,
      });
      if (response.ok) {
        return { healthy: true };
      }
      return {
        healthy: false,
        error: `Gateway returned HTTP ${response.status} ${response.statusText}`,
      };
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return {
          healthy: false,
          error: "Gateway health check timed out after 10 seconds",
        };
      }
      const msg = err instanceof Error ? err.message : String(err);
      return { healthy: false, error: `Gateway unreachable: ${msg}` };
    } finally {
      clearTimeout(timeout);
    }
  }

  return {
    discoverWorkspace,
    checkGateway,
  };
}
