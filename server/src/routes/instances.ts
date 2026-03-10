import path from "node:path";
import { Router } from "express";
import type { Db } from "@paperclipai/db";
import { validateConnectionSchema, syncRequestSchema } from "@paperclipai/shared";
import { validate } from "../middleware/validate.js";
import { instanceService } from "../services/index.js";
import { assertBoard } from "./authz.js";

const AGENTORGCOMPILER_GENERATED_DIR =
  process.env.AGENTORGCOMPILER_GENERATED_DIR ??
  path.resolve(process.cwd(), "..", "AgentOrgCompiler", "generated");

export function instanceRoutes(db: Db) {
  const router = Router();
  const svc = instanceService(db);

  // GET /api/instances -- List all discovered instances
  router.get("/", async (req, res) => {
    assertBoard(req);
    const instances = await svc.listInstances(AGENTORGCOMPILER_GENERATED_DIR);
    res.json(instances);
  });

  // GET /api/instances/:companySlug -- Get instance manifest details
  router.get("/:companySlug", async (req, res) => {
    assertBoard(req);
    const companySlug = req.params.companySlug as string;
    const manifest = await svc.getManifest(AGENTORGCOMPILER_GENERATED_DIR, companySlug);
    res.json(manifest);
  });

  // GET /api/instances/:companySlug/blueprint -- Get raw blueprint YAML content
  router.get("/:companySlug/blueprint", async (req, res) => {
    assertBoard(req);
    const companySlug = req.params.companySlug as string;
    const blueprint = await svc.getBlueprint(AGENTORGCOMPILER_GENERATED_DIR, companySlug);
    res.type("text/yaml").send(blueprint);
  });

  // POST /api/instances/:companySlug/validate -- Run validation checks
  router.post("/:companySlug/validate", validate(validateConnectionSchema), async (req, res) => {
    assertBoard(req);
    const companySlug = req.params.companySlug as string;
    const result = await svc.validateConnection(
      AGENTORGCOMPILER_GENERATED_DIR,
      companySlug,
      req.body.workspacePath,
    );
    res.json(result);
  });

  // POST /api/instances/:companySlug/import -- Import into Paperclip
  router.post("/:companySlug/import", async (req, res) => {
    assertBoard(req);
    const companySlug = req.params.companySlug as string;
    const result = await svc.importToPaperclip(AGENTORGCOMPILER_GENERATED_DIR, companySlug);
    res.json(result);
  });

  // GET /api/instances/:companySlug/sync -- Check sync status
  router.get("/:companySlug/sync", async (req, res) => {
    assertBoard(req);
    const companySlug = req.params.companySlug as string;
    const syncState = await svc.checkSyncStatus(AGENTORGCOMPILER_GENERATED_DIR, companySlug);
    res.json(syncState);
  });

  // POST /api/instances/:companySlug/sync -- Re-sync (re-import with replace)
  router.post("/:companySlug/sync", async (req, res) => {
    assertBoard(req);
    const companySlug = req.params.companySlug as string;
    const result = await svc.importToPaperclip(AGENTORGCOMPILER_GENERATED_DIR, companySlug);
    res.json(result);
  });

  return router;
}
