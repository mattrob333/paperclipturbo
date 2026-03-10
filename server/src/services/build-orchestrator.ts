import { eq, desc, sql } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import {
  companies,
  onboardingPrograms,
  sponsorIntakes,
  synthesisArtifacts,
  onboardingProposals,
  buildRuns,
} from "@paperclipai/db";
import type { BuildPacket, BuildRun as BuildRunType, BuildLogEntry, GeneratedFileNode } from "@paperclipai/shared";
import { conflict, notFound } from "../errors.js";
import fsp from "node:fs/promises";
import path from "node:path";

export function buildOrchestratorService(db: Db) {

  async function assembleBuildPacket(programId: string): Promise<BuildPacket> {
    const [program] = await db.select().from(onboardingPrograms)
      .where(eq(onboardingPrograms.id, programId));
    if (!program) throw notFound("Onboarding program not found");

    const [company] = await db.select().from(companies)
      .where(eq(companies.id, program.companyId));
    if (!company) throw notFound("Company not found");

    const [intake] = await db.select().from(sponsorIntakes)
      .where(eq(sponsorIntakes.onboardingProgramId, programId));

    const artifacts = await db.select().from(synthesisArtifacts)
      .where(eq(synthesisArtifacts.onboardingProgramId, programId));

    const [proposal] = await db.select().from(onboardingProposals)
      .where(eq(onboardingProposals.onboardingProgramId, programId))
      .orderBy(desc(onboardingProposals.createdAt))
      .limit(1);

    return {
      version: "1.0.0",
      programId,
      companyId: program.companyId,
      timestamp: new Date().toISOString(),
      business: {
        companyName: company.name,
        companyDescription: company.description,
        sponsorName: intake?.sponsorName ?? "",
        sponsorRole: intake?.sponsorRole ?? "",
        goals: (intake?.currentPriorities as string[]) ?? [],
        targetDepartments: (intake?.targetDepartments as string[]) ?? [],
        currentToolStack: (intake?.currentAiUsage as string[]) ?? [],
        communicationChannels: [],
        painPoints: [],
        constraints: [],
        riskTolerance: intake?.riskTolerance ?? "medium",
        humanReviewBoundaries: [],
        deploymentPace: intake?.deploymentPace ?? "moderate",
        desiredOutcomes: (intake?.desiredOutcomes as string[]) ?? [],
        nonGoals: (intake?.nonGoals as string[]) ?? [],
      },
      analytical: {
        synthesisArtifacts: artifacts.map(a => ({
          type: a.artifactType,
          title: a.title,
          summary: a.summary,
          payload: (a.payloadJson as Record<string, unknown>) ?? {},
          confidence: a.confidenceSummary as number | null,
        })),
        approvedProposal: {
          topFindings: (proposal?.topFindings as string[]) ?? [],
          hybridOrgSummary: proposal?.hybridOrgSummary ?? null,
          humanLedBoundaries: (proposal?.humanLedBoundaries as string[]) ?? [],
          proposedAgentCount: (proposal?.proposedAgentIds as string[])?.length ?? 0,
        },
      },
      technical: {
        targetWorkspaceContract: {
          rootPath: "generated/{company-slug}/",
          agentDirectoryPattern: "agents/{agent-slug}/",
          requiredFiles: [
            "company.yaml",
            "agents/{agent-slug}/soul.md",
            "agents/{agent-slug}/config.yaml",
          ],
          optionalFiles: [
            "agents/{agent-slug}/tools/",
            "agents/{agent-slug}/knowledge/",
            "instance.manifest.yaml",
          ],
        },
        soulMdSections: [
          "identity", "voice", "boundaries", "capabilities",
          "workflows", "escalation", "collaboration",
        ],
        runtimeDefaults: {
          adapter: "openclaw",
          defaultModel: "claude-sonnet-4-5-20250929",
          heartbeatMode: "cron",
          sandboxMode: true,
        },
      },
    };
  }

  async function startBuild(programId: string): Promise<BuildRunType> {
    // Check no active build exists
    const [existing] = await db.select().from(buildRuns)
      .where(eq(buildRuns.onboardingProgramId, programId))
      .orderBy(desc(buildRuns.createdAt))
      .limit(1);

    if (existing && !["completed", "failed"].includes(existing.status)) {
      throw conflict("An active build already exists for this program");
    }

    // Verify an approved proposal exists
    const [proposal] = await db.select().from(onboardingProposals)
      .where(eq(onboardingProposals.onboardingProgramId, programId))
      .orderBy(desc(onboardingProposals.createdAt))
      .limit(1);

    if (!proposal) {
      throw conflict("Cannot start build: no proposal exists for this program");
    }
    if (!["org_approved", "provisioning_approved"].includes(proposal.status)) {
      throw conflict(`Cannot start build: proposal is in "${proposal.status}" status. It must be approved first.`);
    }

    // Insert new build run
    const [row] = await db.insert(buildRuns).values({
      onboardingProgramId: programId,
      status: "queued",
      currentStage: "initializing",
      stageProgress: 0,
      agentCount: 0,
      fileCount: 0,
      log: [],
    }).returning();

    // Update program status to provisioning
    await db.update(onboardingPrograms)
      .set({ status: "provisioning", updatedAt: new Date() })
      .where(eq(onboardingPrograms.id, programId));

    return castBuildRun(row);
  }

  async function getBuildRun(buildRunId: string): Promise<BuildRunType | null> {
    const [row] = await db.select().from(buildRuns)
      .where(eq(buildRuns.id, buildRunId));
    if (!row) return null;
    return castBuildRun(row);
  }

  async function getBuildRunForProgram(programId: string): Promise<BuildRunType | null> {
    const [row] = await db.select().from(buildRuns)
      .where(eq(buildRuns.onboardingProgramId, programId))
      .orderBy(desc(buildRuns.createdAt))
      .limit(1);
    if (!row) return null;
    return castBuildRun(row);
  }

  async function appendBuildLog(buildRunId: string, entry: BuildLogEntry): Promise<void> {
    await db.update(buildRuns)
      .set({
        log: sql`${buildRuns.log} || ${JSON.stringify([entry])}::jsonb`,
        updatedAt: new Date(),
      })
      .where(eq(buildRuns.id, buildRunId));
  }

  async function updateBuildStatus(
    buildRunId: string,
    updates: {
      status?: string;
      currentStage?: string;
      stageProgress?: number;
      agentCount?: number;
      fileCount?: number;
      validationPassed?: boolean;
      errorMessage?: string;
      completedAt?: Date;
    },
  ): Promise<BuildRunType> {
    const setData: Record<string, unknown> = { updatedAt: new Date() };
    if (updates.status !== undefined) setData.status = updates.status;
    if (updates.currentStage !== undefined) setData.currentStage = updates.currentStage;
    if (updates.stageProgress !== undefined) setData.stageProgress = updates.stageProgress;
    if (updates.agentCount !== undefined) setData.agentCount = updates.agentCount;
    if (updates.fileCount !== undefined) setData.fileCount = updates.fileCount;
    if (updates.validationPassed !== undefined) setData.validationPassed = updates.validationPassed;
    if (updates.errorMessage !== undefined) setData.errorMessage = updates.errorMessage;
    if (updates.completedAt !== undefined) setData.completedAt = updates.completedAt;

    const [row] = await db.update(buildRuns)
      .set(setData)
      .where(eq(buildRuns.id, buildRunId))
      .returning();

    if (!row) throw notFound("Build run not found");
    return castBuildRun(row);
  }

  async function getGeneratedFileTree(companySlug: string): Promise<GeneratedFileNode | null> {
    const rootPath = path.resolve(process.cwd(), "..", "AgentOrgCompiler", "generated", companySlug);

    try {
      await fsp.access(rootPath);
    } catch {
      return null;
    }

    return buildFileTree(rootPath, companySlug);
  }

  async function buildFileTree(dirPath: string, name: string): Promise<GeneratedFileNode> {
    const stat = await fsp.stat(dirPath);

    if (!stat.isDirectory()) {
      return {
        name,
        path: dirPath,
        type: "file",
        size: stat.size,
      };
    }

    const entries = await fsp.readdir(dirPath);
    const children: GeneratedFileNode[] = [];

    for (const entry of entries) {
      const childPath = path.join(dirPath, entry);
      children.push(await buildFileTree(childPath, entry));
    }

    return {
      name,
      path: dirPath,
      type: "directory",
      children,
    };
  }

  function castBuildRun(row: typeof buildRuns.$inferSelect): BuildRunType {
    return {
      id: row.id,
      onboardingProgramId: row.onboardingProgramId,
      status: row.status as BuildRunType["status"],
      currentStage: row.currentStage,
      stageProgress: row.stageProgress,
      agentCount: row.agentCount,
      fileCount: row.fileCount,
      validationPassed: row.validationPassed,
      errorMessage: row.errorMessage,
      log: (row.log ?? []) as unknown as BuildRunType["log"],
      startedAt: row.startedAt?.toISOString() ?? null,
      completedAt: row.completedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  return {
    assembleBuildPacket,
    startBuild,
    getBuildRun,
    getBuildRunForProgram,
    appendBuildLog,
    updateBuildStatus,
    getGeneratedFileTree,
  };
}
