import { eq, desc, sql } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { provisioningJobs, companies, agents } from "@paperclipai/db";
import type { ProvisioningPhase, ProvisioningLogEntry } from "@paperclipai/shared";
import fs from "node:fs";
import fsp from "node:fs/promises";
import { notFound, conflict } from "../errors.js";

export function provisioningService(db: Db) {
  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  /** Append a structured log entry to the job's jsonb log array. */
  async function appendLog(jobId: string, entry: ProvisioningLogEntry): Promise<void> {
    await db
      .update(provisioningJobs)
      .set({
        log: sql`${provisioningJobs.log} || ${JSON.stringify([entry])}::jsonb`,
        updatedAt: new Date(),
      })
      .where(eq(provisioningJobs.id, jobId));
  }

  /** Advance the current phase and optionally set progress. */
  async function setPhase(
    jobId: string,
    phase: ProvisioningPhase,
    progress: number = 0,
  ): Promise<void> {
    await db
      .update(provisioningJobs)
      .set({
        currentPhase: phase,
        phaseProgress: progress,
        updatedAt: new Date(),
      })
      .where(eq(provisioningJobs.id, jobId));
  }

  /** Build a ProvisioningLogEntry with current timestamp. */
  function logEntry(
    level: ProvisioningLogEntry["level"],
    phase: ProvisioningPhase,
    message: string,
    detail?: string,
  ): ProvisioningLogEntry {
    return { ts: new Date().toISOString(), level, phase, message, ...(detail ? { detail } : {}) };
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  return {
    /**
     * Create a new provisioning job for a company.
     * Sets the company status to "provisioning" and inserts a queued job row.
     */
    async createJob(
      companyId: string,
      config: { workspaceRoot?: string; gatewayUrl?: string } = {},
    ) {
      // Verify company exists
      const [company] = await db
        .select()
        .from(companies)
        .where(eq(companies.id, companyId));
      if (!company) throw notFound("Company not found");

      // Check for an already-active provisioning job
      const [existing] = await db
        .select()
        .from(provisioningJobs)
        .where(eq(provisioningJobs.companyId, companyId))
        .orderBy(desc(provisioningJobs.createdAt))
        .limit(1);

      if (existing && !["completed", "failed"].includes(existing.status)) {
        throw conflict("An active provisioning job already exists for this company");
      }

      // Mark company as provisioning
      await db
        .update(companies)
        .set({ status: "provisioning", updatedAt: new Date() })
        .where(eq(companies.id, companyId));

      // Insert the job row
      const [job] = await db
        .insert(provisioningJobs)
        .values({
          companyId,
          status: "queued",
          currentPhase: "pending",
          workspacePath: config.workspaceRoot ?? null,
          gatewayUrl: config.gatewayUrl ?? null,
          provisioningMode: "cold_start",
          runtimeMode: "shared",
        })
        .returning();

      return job;
    },

    /** Retrieve a provisioning job by its ID. */
    async getJob(jobId: string) {
      const [row] = await db
        .select()
        .from(provisioningJobs)
        .where(eq(provisioningJobs.id, jobId));
      return row ?? null;
    },

    /** Get the most recent provisioning job for a company. */
    async getActiveJobForCompany(companyId: string) {
      const [row] = await db
        .select()
        .from(provisioningJobs)
        .where(eq(provisioningJobs.companyId, companyId))
        .orderBy(desc(provisioningJobs.createdAt))
        .limit(1);
      return row ?? null;
    },

    /**
     * Execute all 6 provisioning phases sequentially.
     *
     * Phase 1 - infra_check:      Verify workspace root exists / can be created
     * Phase 2 - workspace_init:   Copy baseline template via workspace-initializer
     * Phase 3 - runtime_attach:   Health-check the OpenClaw gateway (best-effort)
     * Phase 4 - workspace_verify: Validate workspace file structure
     * Phase 5 - generation:       Generate enhanced workspace content via generation worker
     * Phase 6 - activation:       Create agent rows, mark company active
     */
    async executeJob(
      jobId: string,
      options: {
        workspaceRoot: string;
        gatewayUrl: string;
        companyName: string;
        companySlug: string;
        companyDescription?: string;
      },
    ) {
      // Mark running
      await db
        .update(provisioningJobs)
        .set({ status: "running", startedAt: new Date(), updatedAt: new Date() })
        .where(eq(provisioningJobs.id, jobId));

      const job = await this.getJob(jobId);
      if (!job) throw notFound("Provisioning job not found");

      const workspacePath = `${options.workspaceRoot}/${options.companySlug}`;

      try {
        // === Phase 1: infra_check ===
        await setPhase(jobId, "infra_check");
        await appendLog(jobId, logEntry("info", "infra_check", "Checking infrastructure readiness"));

        if (!fs.existsSync(options.workspaceRoot)) {
          await fsp.mkdir(options.workspaceRoot, { recursive: true });
          await appendLog(
            jobId,
            logEntry("info", "infra_check", `Created workspace root: ${options.workspaceRoot}`),
          );
        }

        await setPhase(jobId, "infra_check", 100);
        await appendLog(jobId, logEntry("info", "infra_check", "Infrastructure check passed"));

        // === Phase 2: workspace_init ===
        await setPhase(jobId, "workspace_init");
        await appendLog(
          jobId,
          logEntry("info", "workspace_init", `Initializing workspace at ${workspacePath}`),
        );

        const { workspaceInitializerService } = await import("./workspace-initializer.js");
        const initializer = workspaceInitializerService();

        if (!initializer.baselineExists()) {
          throw new Error(
            "OpenClaw baseline template not found. Ensure the server installation is complete.",
          );
        }

        const existingConfigPath = `${workspacePath}/openclaw-agents-config.json`;
        if (fs.existsSync(existingConfigPath)) {
          await appendLog(
            jobId,
            logEntry("info", "workspace_init", "Workspace already initialized, skipping re-initialization"),
          );
        } else {
          const initResult = await initializer.initializeWorkspace({
            workspacePath,
            companyName: options.companyName,
            companySlug: options.companySlug,
            companyDescription: options.companyDescription,
          });

          await appendLog(
            jobId,
            logEntry(
              "info",
              "workspace_init",
              `Workspace initialized with ${initResult.filesCreated.length} files`,
            ),
          );
        }

        // Persist resolved workspace path
        await db
          .update(provisioningJobs)
          .set({ workspacePath, updatedAt: new Date() })
          .where(eq(provisioningJobs.id, jobId));

        await setPhase(jobId, "workspace_init", 100);

        // === Phase 3: runtime_attach ===
        await setPhase(jobId, "runtime_attach");
        await appendLog(
          jobId,
          logEntry("info", "runtime_attach", `Attaching to existing OpenClaw runtime at ${options.gatewayUrl}`),
        );

        await db
          .update(provisioningJobs)
          .set({ gatewayUrl: options.gatewayUrl, updatedAt: new Date() })
          .where(eq(provisioningJobs.id, jobId));

        // Gateway health check — gateway must be reachable for agents to function
        {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10_000);
          const healthUrl = options.gatewayUrl.replace(/\/v1\/responses$/, "/health");
          try {
            const response = await fetch(healthUrl, {
              method: "GET",
              signal: controller.signal,
            }).finally(() => clearTimeout(timeoutId));

            if (response.ok) {
              await appendLog(
                jobId,
                logEntry("info", "runtime_attach", "OpenClaw gateway is healthy"),
              );
            } else {
              throw new Error(
                `OpenClaw gateway returned status ${response.status}. Ensure the gateway is running before provisioning.`,
              );
            }
          } catch (err) {
            if (err instanceof Error && err.message.startsWith("OpenClaw gateway returned")) {
              throw err;
            }
            const detail = err instanceof Error ? err.message : "unknown error";
            throw new Error(
              `OpenClaw gateway is not reachable at ${healthUrl}. Ensure the gateway is running before provisioning. (${detail})`,
            );
          }
        }

        await setPhase(jobId, "runtime_attach", 100);

        // === Phase 4: workspace_verify ===
        await setPhase(jobId, "workspace_verify");
        await appendLog(
          jobId,
          logEntry("info", "workspace_verify", "Verifying workspace structure"),
        );

        const agentConfigPath = `${workspacePath}/openclaw-agents-config.json`;
        if (!fs.existsSync(agentConfigPath)) {
          throw new Error(
            `Workspace verification failed: openclaw-agents-config.json not found at ${agentConfigPath}`,
          );
        }

        const agentConfig = JSON.parse(await fsp.readFile(agentConfigPath, "utf-8"));
        const agentFolders: string[] = (agentConfig.agents || []).map(
          (a: { folder: string }) => a.folder,
        );

        for (const folder of agentFolders) {
          const folderPath = `${workspacePath}/${folder}`;
          if (!fs.existsSync(folderPath)) {
            throw new Error(`Workspace verification failed: agent folder "${folder}" not found`);
          }
          for (const file of ["SOUL.md", "AGENTS.md", "IDENTITY.md"]) {
            const filePath = `${folderPath}/${file}`;
            if (!fs.existsSync(filePath)) {
              throw new Error(`Workspace verification failed: ${folder}/${file} not found`);
            }
          }
        }

        await setPhase(jobId, "workspace_verify", 100);
        await appendLog(
          jobId,
          logEntry(
            "info",
            "workspace_verify",
            `Workspace verified: ${agentFolders.length} agent folder(s) with required files`,
          ),
        );

        // === Phase 5: generation ===
        await setPhase(jobId, "generation");
        await appendLog(jobId, logEntry("info", "generation", "Starting workspace content generation"));

        // Import and invoke generation worker
        const { generationWorkerService } = await import("./generation-worker.js");
        const genWorker = generationWorkerService();

        const genResult = await genWorker.generateContent(
          {
            companyName: options.companyName,
            companyDescription: options.companyDescription,
            workspacePath,
          },
          async (progress) => {
            // Update job progress as generation advances
            const progressPct = progress.phase === "complete" ? 100
              : progress.phase === "starting" ? 10
              : Math.min(90, 10 + progress.filesWritten.length * 20);
            await setPhase(jobId, "generation", progressPct);
            await appendLog(jobId, logEntry(
              progress.phase === "warning" ? "warn" : "info",
              "generation",
              progress.message,
            ));
          },
        );

        if (!genResult.success) {
          throw new Error(`Generation failed: ${genResult.error ?? "unknown error"}`);
        }

        await setPhase(jobId, "generation", 100);
        await appendLog(jobId, logEntry(
          "info",
          "generation",
          `Generation complete: ${genResult.filesGenerated.length} file(s) generated`,
        ));

        // === Phase 6: activation ===
        await this.activateCompany(jobId);
      } catch (err) {
        // Determine which phase we failed in
        const current = await this.getJob(jobId);
        const failedPhase = (current?.currentPhase ?? "pending") as ProvisioningPhase;
        const message = err instanceof Error ? err.message : "Unknown error";

        await db.transaction(async (tx) => {
          await tx
            .update(provisioningJobs)
            .set({
              status: "failed",
              errorMessage: message,
              errorPhase: failedPhase,
              completedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(provisioningJobs.id, jobId));

          await tx
            .update(companies)
            .set({ status: "failed", updatedAt: new Date() })
            .where(eq(companies.id, job.companyId));
        });

        await appendLog(jobId, logEntry("error", failedPhase, message));

        throw err;
      }
    },

    /**
     * Phase 6: Activate the company.
     * Reads the agent config from the workspace, creates agent rows with OpenClaw
     * adapter configuration, and marks the company as active.
     */
    async activateCompany(jobId: string) {
      const job = await this.getJob(jobId);
      if (!job) throw notFound("Provisioning job not found");

      await setPhase(jobId, "activation");
      await appendLog(jobId, logEntry("info", "activation", "Activating company"));

      // Create agent rows from the workspace agent config
      // Read agent definitions outside the transaction
      let agentDefs: Array<{ name: string; role: string; folder: string }> = [];
      if (job.workspacePath) {
        const agentConfigPath = `${job.workspacePath}/openclaw-agents-config.json`;

        if (fs.existsSync(agentConfigPath)) {
          const agentConfig = JSON.parse(await fsp.readFile(agentConfigPath, "utf-8"));
          agentDefs = agentConfig.agents ?? [];
        }
      }

      // Wrap all writes in a transaction
      await db.transaction(async (tx) => {
        for (const agentDef of agentDefs) {
          const agentWorkspace = `${job.workspacePath}/${agentDef.folder}`;
          // Use forward slashes for path separator (OpenClaw runs in Docker/Linux)
          const sep = agentWorkspace.includes("\\") ? "\\" : "/";

          await tx
            .insert(agents)
            .values({
              companyId: job.companyId,
              name: agentDef.name,
              role: agentDef.role,
              status: "idle",
              adapterType: "openclaw",
              adapterConfig: {
                url: job.gatewayUrl,
                cwd: agentWorkspace,
                workspacePath: agentWorkspace,
                workspaceRoot: agentWorkspace,
                openclawWorkspace: agentWorkspace,
                instructionsFilePath: `${agentWorkspace}${sep}SOUL.md`,
                agentsMdPath: `${agentWorkspace}${sep}AGENTS.md`,
              },
              runtimeConfig: {
                heartbeat: {
                  enabled: true,
                  intervalSec: 3600,
                  wakeOnDemand: true,
                  cooldownSec: 10,
                  maxConcurrentRuns: 1,
                },
              },
            })
            .onConflictDoNothing();
        }

        // Mark company as active
        await tx
          .update(companies)
          .set({ status: "active", updatedAt: new Date() })
          .where(eq(companies.id, job.companyId));

        // Mark job as completed
        await tx
          .update(provisioningJobs)
          .set({
            status: "completed",
            currentPhase: "activation",
            phaseProgress: 100,
            completedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(provisioningJobs.id, jobId));
      });

      // Log agent creation outside transaction (non-critical)
      for (const agentDef of agentDefs) {
        await appendLog(
          jobId,
          logEntry("info", "activation", `Created agent: ${agentDef.name} (${agentDef.role})`),
        );
      }

      await appendLog(
        jobId,
        logEntry("info", "activation", "Company activated successfully"),
      );
    },

    /**
     * Retry a failed provisioning job.
     * Resets the job status to queued and increments the retry counter.
     */
    async retryJob(jobId: string) {
      const job = await this.getJob(jobId);
      if (!job) throw notFound("Provisioning job not found");
      if (job.status !== "failed") {
        throw conflict("Can only retry failed jobs");
      }

      await db.transaction(async (tx) => {
        await tx
          .update(provisioningJobs)
          .set({
            status: "queued",
            currentPhase: "pending",
            errorMessage: null,
            errorPhase: null,
            retryCount: job.retryCount + 1,
            completedAt: null,
            updatedAt: new Date(),
          })
          .where(eq(provisioningJobs.id, jobId));

        // Reset company status from failed to provisioning
        await tx
          .update(companies)
          .set({ status: "provisioning", updatedAt: new Date() })
          .where(eq(companies.id, job.companyId));
      });

      await appendLog(
        jobId,
        logEntry("info", "pending", `Retry #${job.retryCount + 1} initiated`),
      );

      return this.getJob(jobId);
    },
  };
}
