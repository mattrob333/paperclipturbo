import { eq, desc } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { onboardingPrograms, sponsorIntakes, onboardingParticipants, synthesisArtifacts, onboardingProposals, discoveryQuestions, discoveryResponses } from "@paperclipai/db";
import type { OnboardingProgram, OnboardingProgramSummary, OnboardingProgramStatus, OnboardingProgramPhase, OnboardingProgramDetail, OnboardingProgramProgress, SponsorIntake, OnboardingProposal } from "@paperclipai/shared";
import { notFound } from "../errors.js";

export function onboardingProgramService(db: Db) {

  async function createProgram(companyId: string, title?: string): Promise<OnboardingProgram> {
    const [row] = await db.insert(onboardingPrograms).values({
      companyId,
      title: title ?? null,
    }).returning();
    return row as unknown as OnboardingProgram;
  }

  async function getProgram(id: string): Promise<OnboardingProgram> {
    const [row] = await db.select().from(onboardingPrograms).where(eq(onboardingPrograms.id, id));
    if (!row) throw notFound("Onboarding program not found");
    return row as unknown as OnboardingProgram;
  }

  async function listByCompany(companyId: string): Promise<OnboardingProgramSummary[]> {
    const programs = await db.select().from(onboardingPrograms)
      .where(eq(onboardingPrograms.companyId, companyId))
      .orderBy(desc(onboardingPrograms.createdAt));

    const summaries: OnboardingProgramSummary[] = [];
    for (const p of programs) {
      const participants = await db.select().from(onboardingParticipants)
        .where(eq(onboardingParticipants.onboardingProgramId, p.id));
      const completedCount = participants.filter(pt => pt.status === "completed").length;

      const [intake] = await db.select().from(sponsorIntakes)
        .where(eq(sponsorIntakes.onboardingProgramId, p.id));

      const synthesis = await db.select().from(synthesisArtifacts)
        .where(eq(synthesisArtifacts.onboardingProgramId, p.id));

      const [proposal] = await db.select().from(onboardingProposals)
        .where(eq(onboardingProposals.onboardingProgramId, p.id));

      summaries.push({
        id: p.id,
        companyId: p.companyId,
        status: p.status as OnboardingProgramSummary["status"],
        phase: p.phase as OnboardingProgramSummary["phase"],
        title: p.title,
        participantCount: participants.length,
        completedParticipantCount: completedCount,
        hasIntake: !!intake,
        hasSynthesis: synthesis.length > 0,
        hasProposal: !!proposal,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
      });
    }
    return summaries;
  }

  async function updateProgram(id: string, data: { status?: OnboardingProgramStatus; phase?: OnboardingProgramPhase; title?: string }): Promise<OnboardingProgram> {
    const [row] = await db.update(onboardingPrograms)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(onboardingPrograms.id, id))
      .returning();
    if (!row) throw notFound("Onboarding program not found");
    return row as unknown as OnboardingProgram;
  }

  async function getProgramDetail(id: string): Promise<OnboardingProgramDetail> {
    const [program] = await db.select().from(onboardingPrograms).where(eq(onboardingPrograms.id, id));
    if (!program) throw notFound("Onboarding program not found");

    const [intake] = await db.select().from(sponsorIntakes)
      .where(eq(sponsorIntakes.onboardingProgramId, id));

    const participants = await db.select().from(onboardingParticipants)
      .where(eq(onboardingParticipants.onboardingProgramId, id));

    const questions = await db.select().from(discoveryQuestions)
      .where(eq(discoveryQuestions.onboardingProgramId, id));

    const questionIds = questions.map(q => q.id);
    let totalResponses = 0;
    if (questionIds.length > 0) {
      // Count all responses for questions in this program
      const responses = await db.select().from(discoveryResponses);
      totalResponses = responses.filter(r => questionIds.includes(r.questionId)).length;
    }

    const synthesis = await db.select().from(synthesisArtifacts)
      .where(eq(synthesisArtifacts.onboardingProgramId, id));

    const [proposal] = await db.select().from(onboardingProposals)
      .where(eq(onboardingProposals.onboardingProgramId, id));

    return {
      program: program as unknown as OnboardingProgram,
      intake: (intake as unknown as SponsorIntake) ?? null,
      participantCount: participants.length,
      completedParticipantCount: participants.filter(p => p.status === "completed").length,
      questionCount: questions.length,
      totalResponseCount: totalResponses,
      synthesisArtifactCount: synthesis.length,
      proposal: (proposal as unknown as OnboardingProposal) ?? null,
    };
  }

  async function getProgramProgress(id: string): Promise<OnboardingProgramProgress> {
    const [program] = await db.select().from(onboardingPrograms).where(eq(onboardingPrograms.id, id));
    if (!program) throw notFound("Onboarding program not found");

    const [intake] = await db.select().from(sponsorIntakes)
      .where(eq(sponsorIntakes.onboardingProgramId, id));

    const participants = await db.select().from(onboardingParticipants)
      .where(eq(onboardingParticipants.onboardingProgramId, id));

    const questions = await db.select().from(discoveryQuestions)
      .where(eq(discoveryQuestions.onboardingProgramId, id));

    const questionIds = questions.map(q => q.id);
    let totalResponses = 0;
    if (questionIds.length > 0) {
      const allResponses = await db.select().from(discoveryResponses);
      totalResponses = allResponses.filter(r => questionIds.includes(r.questionId)).length;
    }

    const synthesis = await db.select().from(synthesisArtifacts)
      .where(eq(synthesisArtifacts.onboardingProgramId, id));

    const [proposal] = await db.select().from(onboardingProposals)
      .where(eq(onboardingProposals.onboardingProgramId, id));

    const invited = participants.filter(p => p.status === "invited").length;
    const active = participants.filter(p => p.status === "active").length;
    const completed = participants.filter(p => p.status === "completed").length;
    const totalExpected = participants.length * questions.length;
    const completionPercent = totalExpected > 0 ? Math.round((totalResponses / totalExpected) * 100) : 0;

    // Determine next recommended action
    let nextRecommendedAction = "Create an onboarding program";
    if (!intake) {
      nextRecommendedAction = "Complete sponsor intake";
    } else if (!intake.completedAt) {
      nextRecommendedAction = "Finalize sponsor intake";
    } else if (participants.length === 0) {
      nextRecommendedAction = "Invite participants";
    } else if (completed === 0 && totalResponses === 0) {
      nextRecommendedAction = "Begin discovery sessions";
    } else if (completionPercent < 100) {
      nextRecommendedAction = "Complete remaining discovery sessions";
    } else if (synthesis.length === 0) {
      nextRecommendedAction = "Run synthesis analysis";
    } else if (!proposal) {
      nextRecommendedAction = "Generate proposal";
    } else {
      nextRecommendedAction = "Review and approve proposal";
    }

    return {
      programId: id,
      phase: program.phase as OnboardingProgramProgress["phase"],
      status: program.status as OnboardingProgramProgress["status"],
      intakeComplete: !!intake?.completedAt,
      participantCount: participants.length,
      participantsInvited: invited,
      participantsActive: active,
      participantsCompleted: completed,
      totalQuestions: questions.length,
      totalResponses,
      discoveryCompletionPercent: completionPercent,
      synthesisReady: synthesis.length > 0,
      proposalReady: !!proposal,
      nextRecommendedAction,
    };
  }

  return { createProgram, getProgram, listByCompany, updateProgram, getProgramDetail, getProgramProgress };
}
