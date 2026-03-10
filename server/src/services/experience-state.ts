import { eq, desc, inArray, sql } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import {
  onboardingPrograms,
  sponsorIntakes,
  onboardingParticipants,
  discoveryQuestions,
  discoveryResponses,
  synthesisArtifacts,
  onboardingProposals,
  buildRuns,
} from "@paperclipai/db";
import { deriveExperienceState } from "@paperclipai/shared";
import type {
  ExperienceStateInfo,
  BuildRun as BuildRunType,
  OnboardingProgram,
  SponsorIntake,
  OnboardingProposal,
} from "@paperclipai/shared";

export function experienceStateService(db: Db) {

  async function getExperienceState(companyId: string): Promise<ExperienceStateInfo> {
    // Get latest onboarding program for this company
    const [program] = await db.select().from(onboardingPrograms)
      .where(eq(onboardingPrograms.companyId, companyId))
      .orderBy(desc(onboardingPrograms.createdAt))
      .limit(1);

    if (!program) {
      return {
        state: "not_started",
        programId: null,
        programTitle: null,
        nextAction: "Start onboarding",
        nextActionPath: "/onboarding",
        completedSteps: [],
        buildRun: null,
      };
    }

    // Query related data
    const [intake] = await db.select().from(sponsorIntakes)
      .where(eq(sponsorIntakes.onboardingProgramId, program.id));

    const participants = await db.select().from(onboardingParticipants)
      .where(eq(onboardingParticipants.onboardingProgramId, program.id));

    const questions = await db.select().from(discoveryQuestions)
      .where(eq(discoveryQuestions.onboardingProgramId, program.id));

    const questionIds = questions.map(q => q.id);
    let responseCount = 0;
    if (questionIds.length > 0) {
      const [countResult] = await db.select({ count: sql<number>`count(*)::int` })
        .from(discoveryResponses)
        .where(inArray(discoveryResponses.questionId, questionIds));
      responseCount = countResult?.count ?? 0;
    }

    const artifacts = await db.select().from(synthesisArtifacts)
      .where(eq(synthesisArtifacts.onboardingProgramId, program.id));

    const [proposal] = await db.select().from(onboardingProposals)
      .where(eq(onboardingProposals.onboardingProgramId, program.id))
      .orderBy(desc(onboardingProposals.createdAt))
      .limit(1);

    // Get latest build run
    const latestBuild = await getLatestBuildRun(program.id);

    const completedParticipantCount = participants.filter(p => p.status === "completed").length;
    const totalExpectedResponses = participants.length * questions.length;

    // Derive state
    const state = deriveExperienceState({
      program: {
        id: program.id,
        companyId: program.companyId,
        title: program.title,
        phase: program.phase as OnboardingProgram["phase"],
        status: program.status as OnboardingProgram["status"],
        schemaVersion: program.schemaVersion,
        createdAt: program.createdAt.toISOString(),
        updatedAt: program.updatedAt.toISOString(),
      },
      intake: intake ? {
        id: intake.id,
        onboardingProgramId: intake.onboardingProgramId,
        sponsorName: intake.sponsorName,
        sponsorRole: intake.sponsorRole,
        currentPriorities: (intake.currentPriorities as string[]) ?? [],
        targetDepartments: (intake.targetDepartments as string[]) ?? [],
        deploymentPace: intake.deploymentPace as SponsorIntake["deploymentPace"],
        riskTolerance: intake.riskTolerance as SponsorIntake["riskTolerance"],
        currentAiUsage: (intake.currentAiUsage as string[]) ?? [],
        desiredOutcomes: (intake.desiredOutcomes as string[]) ?? [],
        nonGoals: (intake.nonGoals as string[]) ?? [],
        notes: intake.notes,
        completedAt: intake.completedAt?.toISOString() ?? null,
        createdAt: intake.createdAt.toISOString(),
        updatedAt: intake.updatedAt.toISOString(),
      } : null,
      participantCount: participants.length,
      completedParticipantCount,
      responseCount,
      totalExpectedResponses,
      artifactCount: artifacts.length,
      proposal: proposal ? {
        id: proposal.id,
        onboardingProgramId: proposal.onboardingProgramId,
        version: proposal.version,
        status: proposal.status as OnboardingProposal["status"],
        topFindings: (proposal.topFindings as string[]) ?? [],
        hybridOrgSummary: proposal.hybridOrgSummary,
        proposedAgentIds: (proposal.proposedAgentIds as string[]) ?? [],
        pairingIds: (proposal.pairingIds as string[]) ?? [],
        rolloutPhaseIds: (proposal.rolloutPhaseIds as string[]) ?? [],
        humanLedBoundaries: (proposal.humanLedBoundaries as string[]) ?? [],
        revisionNotes: (proposal.revisionNotes as string[]) ?? [],
        createdAt: proposal.createdAt.toISOString(),
        updatedAt: proposal.updatedAt.toISOString(),
      } : null,
      buildRun: latestBuild,
    });

    // Compute next action and path
    let nextAction: string;
    let nextActionPath: string;
    switch (state) {
      case "not_started":
        nextAction = "Start onboarding";
        nextActionPath = "/onboarding";
        break;
      case "intake_in_progress":
        nextAction = "Complete sponsor intake";
        nextActionPath = `/onboarding/${program.id}/intake`;
        break;
      case "discovery_in_progress":
        nextAction = "Continue discovery";
        nextActionPath = `/onboarding/${program.id}`;
        break;
      case "synthesis_ready":
        nextAction = "Run synthesis";
        nextActionPath = `/onboarding/${program.id}/synthesis`;
        break;
      case "proposal_ready":
        nextAction = "Review proposal";
        nextActionPath = `/onboarding/${program.id}/proposal`;
        break;
      case "build_pending":
        nextAction = "Start build";
        nextActionPath = `/build/${program.id}`;
        break;
      case "building":
        nextAction = "View build progress";
        nextActionPath = `/build/${program.id}`;
        break;
      case "build_failed":
        nextAction = "Review build errors";
        nextActionPath = `/build/${program.id}`;
        break;
      case "provisioned":
        nextAction = "View dashboard";
        nextActionPath = "/dashboard";
        break;
    }

    // Compute completed steps
    const completedSteps: string[] = [];
    if (intake) completedSteps.push("sponsor_intake");
    if (intake?.completedAt) completedSteps.push("intake_completed");
    if (participants.length > 0) completedSteps.push("participants_invited");
    if (responseCount > 0) completedSteps.push("discovery_started");
    if (completedParticipantCount > 0) completedSteps.push("discovery_responses");
    if (artifacts.length > 0) completedSteps.push("synthesis_complete");
    if (proposal) completedSteps.push("proposal_generated");
    if (proposal && (proposal.status === "org_approved" || proposal.status === "provisioning_approved")) {
      completedSteps.push("proposal_approved");
    }
    if (latestBuild) completedSteps.push("build_started");
    if (latestBuild && latestBuild.status === "completed") completedSteps.push("build_complete");

    return {
      state,
      programId: program.id,
      programTitle: program.title,
      nextAction,
      nextActionPath,
      completedSteps,
      buildRun: latestBuild,
    };
  }

  async function getLatestBuildRun(programId: string): Promise<BuildRunType | null> {
    const [row] = await db.select().from(buildRuns)
      .where(eq(buildRuns.onboardingProgramId, programId))
      .orderBy(desc(buildRuns.createdAt))
      .limit(1);

    if (!row) return null;

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

  return { getExperienceState, getLatestBuildRun };
}
