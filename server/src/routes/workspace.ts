import { Router, type Request } from "express";
import type { Db } from "@paperclipai/db";
import { agentService } from "../services/agents.js";
import { workspaceService, WorkspaceError } from "../services/workspace.js";
import { assertCompanyAccess } from "./authz.js";
import { notFound } from "../errors.js";

export function workspaceRoutes(db: Db) {
  const router = Router();
  const svc = agentService(db);
  const workspace = workspaceService();

  async function resolveWorkspaceForAgent(
    req: Request,
    companyId: string,
    agentId: string,
  ) {
    assertCompanyAccess(req, companyId);

    const agent = await svc.getById(agentId);
    if (!agent || agent.companyId !== companyId) {
      throw notFound("Agent not found");
    }

    const adapterConfig =
      typeof agent.adapterConfig === "object" && agent.adapterConfig !== null
        ? (agent.adapterConfig as Record<string, unknown>)
        : {};

    const root = await workspace.resolveWorkspaceRoot(adapterConfig);
    if (!root) {
      return null;
    }

    return root;
  }

  router.get(
    "/companies/:companyId/agents/:agentId/workspace/tree",
    async (req, res) => {
      try {
        const { companyId, agentId } = req.params;

        const root = await resolveWorkspaceForAgent(req, companyId!, agentId!);
        if (!root) {
          res.status(422).json({
            error: "Agent has no workspace configured",
            code: "no_workspace",
          });
          return;
        }

        const relativePath =
          typeof req.query.path === "string" ? req.query.path : "";
        const depth =
          typeof req.query.depth === "string"
            ? Math.max(1, Math.min(10, parseInt(req.query.depth, 10) || 3))
            : 3;

        const nodes = await workspace.listDirectory(root, relativePath, depth);

        res.json({
          root: root,
          agentId: agentId!,
          nodes,
        });
      } catch (err) {
        if (err instanceof WorkspaceError) {
          const statusMap: Record<string, number> = {
            path_traversal: 403,
            not_found: 404,
            permission_denied: 403,
          };
          res
            .status(statusMap[err.code] ?? 500)
            .json({ error: err.message, code: err.code });
          return;
        }
        throw err;
      }
    },
  );

  router.get(
    "/companies/:companyId/agents/:agentId/workspace/file",
    async (req, res) => {
      try {
        const { companyId, agentId } = req.params;

        const root = await resolveWorkspaceForAgent(req, companyId!, agentId!);
        if (!root) {
          res.status(422).json({
            error: "Agent has no workspace configured",
            code: "no_workspace",
          });
          return;
        }

        const filePath =
          typeof req.query.path === "string" ? req.query.path : "";
        if (!filePath) {
          res.status(400).json({
            error: "path query parameter is required",
            code: "read_error",
          });
          return;
        }

        const fileContent = await workspace.readFile(root, filePath);
        res.json(fileContent);
      } catch (err) {
        if (err instanceof WorkspaceError) {
          const statusMap: Record<string, number> = {
            path_traversal: 403,
            not_found: 404,
            permission_denied: 403,
            file_too_large: 413,
            binary_file: 422,
            read_error: 500,
          };
          res
            .status(statusMap[err.code] ?? 500)
            .json({ error: err.message, code: err.code });
          return;
        }
        throw err;
      }
    },
  );

  return router;
}
