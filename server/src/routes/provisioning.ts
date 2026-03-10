import { Router } from "express";
import type { Db } from "@paperclipai/db";
import { startProvisioningSchema, retryProvisioningSchema } from "@paperclipai/shared";
import { validate } from "../middleware/validate.js";
import { provisioningService, instanceReadinessService, companyService } from "../services/index.js";
import { assertBoard } from "./authz.js";

export function provisioningRoutes(db: Db) {
  const router = Router();
  const svc = provisioningService(db);
  const readiness = instanceReadinessService();
  const companySvc = companyService(db);

  // GET /readiness — system readiness check
  router.get("/readiness", async (_req, res) => {
    const result = await readiness.getFullReadiness();
    res.json(result);
  });

  // POST /start — create company and start provisioning
  router.post("/start", validate(startProvisioningSchema), async (req, res) => {
    assertBoard(req);

    const { companyName, companyDescription, workspaceRoot, gatewayUrl } = req.body;

    // Create company in draft status
    const company = await companySvc.create({
      name: companyName,
      description: companyDescription || null,
      status: "draft",
    });

    // Create provisioning job
    const job = await svc.createJob(company.id, {
      workspaceRoot: workspaceRoot || undefined,
      gatewayUrl: gatewayUrl || undefined,
    });

    // Start provisioning asynchronously (don't block the response)
    const resolvedWorkspaceRoot = workspaceRoot || readiness.getWorkspaceRoot();
    const resolvedGatewayUrl = gatewayUrl || readiness.getGatewayUrl();
    const companySlug = company.issuePrefix.toLowerCase();

    // Fire and forget — client polls for status
    svc.executeJob(job.id, {
      workspaceRoot: resolvedWorkspaceRoot,
      gatewayUrl: resolvedGatewayUrl,
      companyName,
      companySlug,
      companyDescription,
    }).catch((err) => {
      console.error("[provisioning] Job execution error:", err);
    });

    res.status(201).json({ company, job });
  });

  // GET /:jobId — get provisioning job status
  router.get("/:jobId", async (req, res) => {
    assertBoard(req);
    const jobId = req.params.jobId as string;
    const job = await svc.getJob(jobId);
    if (!job) {
      res.status(404).json({ error: "Provisioning job not found" });
      return;
    }
    res.json(job);
  });

  // GET /company/:companyId — get latest job for a company
  router.get("/company/:companyId", async (req, res) => {
    assertBoard(req);
    const companyId = req.params.companyId as string;
    const job = await svc.getActiveJobForCompany(companyId);
    if (!job) {
      res.status(404).json({ error: "No provisioning job found for this company" });
      return;
    }
    res.json(job);
  });

  // POST /:jobId/retry — retry a failed job
  router.post("/:jobId/retry", validate(retryProvisioningSchema), async (req, res) => {
    assertBoard(req);
    const jobId = req.params.jobId as string;

    const job = await svc.getJob(jobId);
    if (!job) {
      res.status(404).json({ error: "Provisioning job not found" });
      return;
    }

    const retried = await svc.retryJob(jobId);

    // Re-execute asynchronously
    if (retried) {
      const company = await companySvc.getById(retried.companyId);
      if (company) {
        const companySlug = company.issuePrefix.toLowerCase();
        // Derive workspaceRoot: if workspacePath was set to the full path
        // (root/slug) by a prior Phase 2 run, strip the slug suffix.
        // Otherwise fall back to the system default.
        let workspaceRoot: string;
        if (retried.workspacePath && retried.workspacePath.endsWith(`/${companySlug}`)) {
          workspaceRoot = retried.workspacePath.slice(0, -(companySlug.length + 1));
        } else {
          workspaceRoot = retried.workspacePath || readiness.getWorkspaceRoot();
        }

        svc.executeJob(retried.id, {
          workspaceRoot,
          gatewayUrl: retried.gatewayUrl || readiness.getGatewayUrl(),
          companyName: company.name,
          companySlug,
          companyDescription: company.description || undefined,
        }).catch((err) => {
          console.error("[provisioning] Retry execution error:", err);
        });
      }
    }

    res.json(retried);
  });

  return router;
}
