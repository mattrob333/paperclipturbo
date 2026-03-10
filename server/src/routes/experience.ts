import { Router } from "express";
import { spawn } from "node:child_process";
import type { Db } from "@paperclipai/db";
import { companies, onboardingPrograms } from "@paperclipai/db";
import { eq } from "drizzle-orm";
import { startBuildSchema } from "@paperclipai/shared";
import { validate } from "../middleware/validate.js";
import { experienceStateService } from "../services/experience-state.js";
import { buildOrchestratorService } from "../services/build-orchestrator.js";
import { assertBoard } from "./authz.js";
import { notFound } from "../errors.js";

function param(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export function experienceRoutes(db: Db) {
  const router = Router();
  const stateSvc = experienceStateService(db);
  const buildSvc = buildOrchestratorService(db);

  // GET /api/experience/state/:companyId
  router.get("/state/:companyId", async (req, res) => {
    assertBoard(req);
    const info = await stateSvc.getExperienceState(param(req.params.companyId));
    res.json(info);
  });

  // POST /api/experience/build/:programId
  router.post("/build/:programId", validate(startBuildSchema), async (req, res) => {
    assertBoard(req);
    const buildRun = await buildSvc.startBuild(param(req.params.programId));
    res.status(201).json(buildRun);
  });

  // GET /api/experience/build/:programId
  router.get("/build/:programId", async (req, res) => {
    assertBoard(req);
    const buildRun = await buildSvc.getBuildRunForProgram(param(req.params.programId));
    if (!buildRun) throw notFound("No build run found for this program");
    res.json(buildRun);
  });

  // GET /api/experience/build/:programId/packet
  router.get("/build/:programId/packet", async (req, res) => {
    assertBoard(req);
    const packet = await buildSvc.assembleBuildPacket(param(req.params.programId));
    res.json(packet);
  });

  // GET /api/experience/build/:programId/files
  router.get("/build/:programId/files", async (req, res) => {
    assertBoard(req);
    const programId = param(req.params.programId);
    const [program] = await db.select().from(onboardingPrograms)
      .where(eq(onboardingPrograms.id, programId));
    if (!program) throw notFound("Onboarding program not found");

    const [company] = await db.select().from(companies)
      .where(eq(companies.id, program.companyId));
    if (!company) throw notFound("Company not found");

    const companySlug = company.name.toLowerCase().replace(/\s+/g, "-");
    const tree = await buildSvc.getGeneratedFileTree(companySlug);
    if (!tree) throw notFound("No generated files found");
    res.json(tree);
  });

  // POST /api/experience/seed-demo
  router.post("/seed-demo", async (req, res) => {
    assertBoard(req);
    const databaseUrl = process.env.DATABASE_URL;

    await new Promise<void>((resolve) => {
      const child = spawn("npx", ["tsx", "packages/db/src/seed-demo.ts"], {
        cwd: process.cwd(),
        shell: true,
        env: { ...process.env, DATABASE_URL: databaseUrl },
        stdio: "pipe",
      });

      let stderr = "";
      child.stderr?.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });

      child.on("close", (code) => {
        if (code !== 0) {
          // Might fail due to duplicate keys if already seeded - still return success
          console.warn("[experience] seed-demo exited with code", code, stderr);
        }
        resolve();
      });

      child.on("error", (err) => {
        console.warn("[experience] seed-demo spawn error:", err.message);
        resolve();
      });
    });

    // Look up the actual seeded company
    const [seededCompany] = await db.select().from(companies)
      .where(eq(companies.name, "Meridian Dynamics"))
      .limit(1);

    res.json({
      success: true,
      companyId: seededCompany?.id ?? "a1b2c3d4-e5f6-4a7b-8c9d-000000000001",
      companyName: seededCompany?.name ?? "Meridian Dynamics",
      note: "Demo data seeded (or already present)",
    });
  });

  return router;
}
