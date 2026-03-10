import fs from "node:fs";
import type { ReadinessCheck, InstanceReadiness } from "@paperclipai/shared";
import { workspaceInitializerService } from "./workspace-initializer.js";

// Default paths/URLs — can be overridden via environment variables
const DEFAULT_WORKSPACE_ROOT = process.env.OPENCLAW_WORKSPACE_ROOT || "/openclaw-workspace";
const DEFAULT_GATEWAY_URL = process.env.OPENCLAW_GATEWAY_URL || "http://host.docker.internal:18789/v1/responses";

export function instanceReadinessService() {
  const initializer = workspaceInitializerService();

  /** Check if the workspace root directory exists and is writable */
  async function checkWorkspaceRoot(): Promise<ReadinessCheck> {
    const root = DEFAULT_WORKSPACE_ROOT;
    try {
      if (!fs.existsSync(root)) {
        return {
          name: "workspace_root",
          ok: false,
          message: `Workspace root directory not found: ${root}`,
          detail: "Set OPENCLAW_WORKSPACE_ROOT environment variable or create the directory.",
        };
      }
      // Check writable
      await fs.promises.access(root, fs.constants.W_OK);
      return {
        name: "workspace_root",
        ok: true,
        message: `Workspace root exists: ${root}`,
      };
    } catch (err) {
      return {
        name: "workspace_root",
        ok: false,
        message: `Workspace root not writable: ${root}`,
        detail: err instanceof Error ? err.message : undefined,
      };
    }
  }

  /** Check if the OpenClaw baseline template exists */
  function checkBaselineTemplate(): ReadinessCheck {
    const exists = initializer.baselineExists();
    return {
      name: "baseline_template",
      ok: exists,
      message: exists
        ? `Baseline template found at ${initializer.getBaselineDir()}`
        : `Baseline template not found at ${initializer.getBaselineDir()}`,
      detail: exists ? undefined : "The server installation may be incomplete.",
    };
  }

  /** Check if an Anthropic API key is configured */
  function checkAnthropicKey(): ReadinessCheck {
    const key = process.env.ANTHROPIC_API_KEY;
    const hasKey = typeof key === "string" && key.trim().length > 0;
    return {
      name: "anthropic_key",
      ok: hasKey,
      message: hasKey
        ? "Anthropic API key is configured"
        : "Anthropic API key is not set",
      detail: hasKey ? undefined : "Set the ANTHROPIC_API_KEY environment variable for content generation.",
    };
  }

  /** Check if the OpenClaw gateway is reachable */
  async function checkGatewayHealth(gatewayUrl?: string): Promise<ReadinessCheck> {
    const url = gatewayUrl || DEFAULT_GATEWAY_URL;
    const healthUrl = url.replace(/\/v1\/responses$/, "/health");

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const response = await fetch(healthUrl, {
        method: "GET",
        signal: controller.signal,
      }).finally(() => clearTimeout(timeoutId));

      if (response.ok) {
        return {
          name: "gateway_health",
          ok: true,
          message: `OpenClaw gateway is healthy at ${healthUrl}`,
        };
      }
      return {
        name: "gateway_health",
        ok: false,
        message: `OpenClaw gateway returned status ${response.status}`,
        detail: `URL: ${healthUrl}`,
      };
    } catch (err) {
      return {
        name: "gateway_health",
        ok: false,
        message: `Cannot reach OpenClaw gateway at ${healthUrl}`,
        detail: err instanceof Error ? err.message : undefined,
      };
    }
  }

  /** Run all readiness checks and return aggregate status */
  async function getFullReadiness(gatewayUrl?: string): Promise<InstanceReadiness> {
    const checks = await Promise.all([
      checkWorkspaceRoot(),
      Promise.resolve(checkBaselineTemplate()),
      Promise.resolve(checkAnthropicKey()),
      checkGatewayHealth(gatewayUrl),
    ]);

    // Determine overall status
    const failedCount = checks.filter(c => !c.ok).length;
    let overallStatus: InstanceReadiness["overallStatus"];

    if (failedCount === 0) {
      overallStatus = "ready";
    } else if (failedCount <= 1 && checks.find(c => c.name === "anthropic_key")?.ok !== false) {
      // If only gateway health fails (might be Docker networking), degrade rather than block
      overallStatus = "degraded";
    } else {
      overallStatus = "not_ready";
    }

    return {
      checks,
      overallStatus,
      timestamp: new Date().toISOString(),
    };
  }

  return {
    checkWorkspaceRoot,
    checkBaselineTemplate,
    checkAnthropicKey,
    checkGatewayHealth,
    getFullReadiness,
    getWorkspaceRoot: () => DEFAULT_WORKSPACE_ROOT,
    getGatewayUrl: () => DEFAULT_GATEWAY_URL,
  };
}
