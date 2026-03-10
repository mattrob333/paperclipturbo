import { eq } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { companies, agents, provisioningJobs } from "@paperclipai/db";
import type { AttachResult } from "@paperclipai/shared";
import { conflict } from "../errors.js";

/**
 * Derive a 3-letter issue prefix from a company name.
 * Mirrors the logic in companies.ts → deriveIssuePrefixBase.
 */
function deriveIssuePrefixBase(name: string): string {
  const normalized = name.toUpperCase().replace(/[^A-Z]/g, "");
  return normalized.slice(0, 3) || "CMP";
}

function suffixForAttempt(attempt: number): string {
  if (attempt <= 1) return "";
  return "A".repeat(attempt - 1);
}

function isIssuePrefixConflict(error: unknown): boolean {
  const constraint =
    typeof error === "object" && error !== null && "constraint" in error
      ? (error as { constraint?: string }).constraint
      : typeof error === "object" && error !== null && "constraint_name" in error
        ? (error as { constraint_name?: string }).constraint_name
        : undefined;
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "23505" &&
    constraint === "companies_issue_prefix_idx"
  );
}

function isCompanyNameConflict(error: unknown): boolean {
  const constraint =
    typeof error === "object" && error !== null && "constraint" in error
      ? (error as { constraint?: string }).constraint
      : typeof error === "object" && error !== null && "constraint_name" in error
        ? (error as { constraint_name?: string }).constraint_name
        : undefined;
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "23505" &&
    constraint === "companies_name_uniq"
  );
}

/**
 * Normalize a file path to use forward slashes consistently.
 * OpenClaw runs in Docker/Linux, so we always want forward slashes.
 */
function normalizePath(p: string): string {
  return p.replace(/\\/g, "/");
}

function dedupeAgentsByName(
  input: Array<{ name: string; role: string; folder: string }>,
): Array<{ name: string; role: string; folder: string }> {
  const seen = new Set<string>();
  const deduped: Array<{ name: string; role: string; folder: string }> = [];
  for (const agent of input) {
    const key = agent.name.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(agent);
  }
  return deduped;
}

export function attachService(db: Db) {
  return {
    /**
     * Create a company and its agents from a discovery result.
     * This is the "confirm attach" operation — it creates real DB records
     * for an already-existing OpenClaw workspace.
     */
    async confirmAttach(input: {
      companyName: string;
      companyDescription?: string;
      gatewayUrl: string;
      workspacePath: string;
      agents: Array<{ name: string; role: string; folder: string }>;
    }): Promise<AttachResult> {
      return db.transaction(async (tx) => {
        const agentsToCreate = dedupeAgentsByName(input.agents);

        // 1. Create company with unique issue prefix (retry on prefix conflict)
        //    If company name conflicts, the DB constraint handles it.
        const base = deriveIssuePrefixBase(input.companyName);
        let company: typeof companies.$inferSelect | undefined;
        let suffix = 1;

        while (suffix < 10000) {
          const candidate = `${base}${suffixForAttempt(suffix)}`;
          try {
            const [row] = await tx
              .insert(companies)
              .values({
                name: input.companyName,
                description: input.companyDescription ?? null,
                status: "active", // attached companies are immediately active
                issuePrefix: candidate,
              })
              .returning();
            company = row;
            break;
          } catch (error) {
            if (isCompanyNameConflict(error)) {
              throw conflict(
                `A company named "${input.companyName}" already exists`,
              );
            }
            if (!isIssuePrefixConflict(error)) throw error;
          }
          suffix += 1;
        }

        if (!company) {
          throw new Error("Unable to allocate unique issue prefix");
        }

        const normalizedWorkspacePath = normalizePath(input.workspacePath);

        // Check for duplicate workspace path
        const existingJobWithPath = await tx
          .select()
          .from(provisioningJobs)
          .where(eq(provisioningJobs.workspacePath, normalizedWorkspacePath));
        if (existingJobWithPath.length > 0) {
          throw conflict(
            `A company is already using workspace path "${normalizedWorkspacePath}"`,
          );
        }

        // 2. Create a provisioning job record to track the attach
        const now = new Date();
        const logEntries = [
          {
            ts: now.toISOString(),
            level: "info",
            phase: "activation",
            message: `Attach initiated for workspace: ${normalizedWorkspacePath}`,
          },
          {
            ts: now.toISOString(),
            level: "info",
            phase: "activation",
            message: `Gateway URL: ${input.gatewayUrl}`,
          },
          {
            ts: now.toISOString(),
            level: "info",
            phase: "activation",
            message: `Discovered ${agentsToCreate.length} agent(s): ${agentsToCreate.map((a) => a.name).join(", ")}`,
          },
          {
            ts: now.toISOString(),
            level: "info",
            phase: "activation",
            message: "Company activated via attach (existing workspace)",
          },
        ];

        await tx.insert(provisioningJobs).values({
          companyId: company.id,
          status: "completed",
          currentPhase: "activation",
          phaseProgress: 100,
          workspacePath: normalizedWorkspacePath,
          gatewayUrl: input.gatewayUrl,
          completedAt: now,
          startedAt: now,
          log: logEntries,
          provisioningMode: "attach",
          runtimeMode: "shared",
        });

        // 3. Create agent rows for each discovered agent
        for (const agentDef of agentsToCreate) {
          const agentWorkspace = normalizePath(
            `${input.workspacePath}/${agentDef.folder}`,
          );

          await tx
            .insert(agents)
            .values({
              companyId: company.id,
              name: agentDef.name,
              role: agentDef.role,
              status: "idle",
              adapterType: "openclaw",
              adapterConfig: {
                url: input.gatewayUrl,
                cwd: agentWorkspace,
                workspacePath: agentWorkspace,
                workspaceRoot: agentWorkspace,
                openclawWorkspace: agentWorkspace,
                instructionsFilePath: `${agentWorkspace}/SOUL.md`,
                agentsMdPath: `${agentWorkspace}/AGENTS.md`,
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

        // 4. Return AttachResult
        return {
          companyId: company.id,
          companyName: company.name,
          issuePrefix: company.issuePrefix,
          agentsCreated: agentsToCreate.length,
          gatewayUrl: input.gatewayUrl,
          workspacePath: normalizedWorkspacePath,
          provisioningMode: "attach",
        };
      });
    },
  };
}
