import { Router } from "express";
import type { Db } from "@paperclipai/db";
import { discoverWorkspaceSchema, confirmAttachSchema } from "@paperclipai/shared";
import { validate } from "../middleware/validate.js";
import { validateWorkspacePath } from "../middleware/workspace-path-guard.js";
import { assertBoard } from "./authz.js";
import { attachService } from "../services/attach.js";
import { workspaceDiscoveryService } from "../services/workspace-discovery.js";

export function attachRoutes(db: Db) {
  const router = Router();
  const discovery = workspaceDiscoveryService();
  const svc = attachService(db);

  // POST /api/attach/discover
  // Scan an existing workspace and check gateway health — no DB writes.
  router.post("/discover", validate(discoverWorkspaceSchema), async (req, res) => {
    assertBoard(req);

    const { gatewayUrl, workspacePath } = req.body;
    const deploymentMode = process.env.PAPERCLIP_DEPLOYMENT_MODE || "local_trusted";

    // Validate workspace path against allowed roots in authenticated mode
    let validatedPath: string;
    try {
      validatedPath = validateWorkspacePath(workspacePath, deploymentMode);
    } catch (err) {
      if ((err as any).status === 403) {
        res.status(403).json({ error: (err as Error).message });
        return;
      }
      throw err;
    }

    // Discover workspace structure (agents, config, files)
    const result = await discovery.discoverWorkspace(validatedPath);

    // Check gateway health
    const gatewayCheck = await discovery.checkGateway(gatewayUrl);

    res.json({
      ...result,
      gatewayUrl,
      gatewayHealthy: gatewayCheck.healthy,
      gatewayError: gatewayCheck.error,
    });
  });

  // POST /api/attach/confirm
  // Create company + agents from an existing workspace.
  router.post("/confirm", validate(confirmAttachSchema), async (req, res) => {
    assertBoard(req);

    const {
      gatewayUrl,
      workspacePath,
      companyName,
      companyDescription,
      selectedAgentFolders,
    } = req.body;
    const deploymentMode = process.env.PAPERCLIP_DEPLOYMENT_MODE || "local_trusted";

    // Validate workspace path against allowed roots in authenticated mode
    let validatedPath: string;
    try {
      validatedPath = validateWorkspacePath(workspacePath, deploymentMode);
    } catch (err) {
      if ((err as any).status === 403) {
        res.status(403).json({ error: (err as Error).message });
        return;
      }
      throw err;
    }

    // Re-discover to validate the workspace is still valid
    const discoveryResult = await discovery.discoverWorkspace(validatedPath);

    if (!discoveryResult.configFound) {
      res.status(400).json({
        error: "Workspace validation failed",
        detail: "No openclaw-agents-config.json found at the specified path",
        issues: discoveryResult.issues,
      });
      return;
    }

    // Filter agents by selectedAgentFolders if provided
    let agentsToCreate = discoveryResult.agents
      .filter((a) => a.status !== "missing") // skip missing agents
      .map((a) => ({ name: a.name, role: a.role, folder: a.folder }));

    if (selectedAgentFolders !== undefined) {
      agentsToCreate = agentsToCreate.filter((a) =>
        selectedAgentFolders.includes(a.folder),
      );
    }

    if (agentsToCreate.length === 0) {
      res.status(400).json({
        error: "No agents to create",
        detail:
          selectedAgentFolders !== undefined
            ? "None of the selected agent folders were found in the workspace"
            : "No valid agents were discovered in the workspace",
      });
      return;
    }

    // Confirm the attach — creates company, provisioning job, and agent rows
    const attachResult = await svc.confirmAttach({
      companyName,
      companyDescription,
      gatewayUrl,
      workspacePath,
      agents: agentsToCreate,
    });

    res.status(201).json(attachResult);
  });

  return router;
}
