import { eq, and, asc } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { discoveryQuestions, discoveryResponses, onboardingParticipants } from "@paperclipai/db";
import type { DiscoveryQuestion, DiscoveryResponse } from "@paperclipai/shared";
import { notFound } from "../errors.js";

export function discoveryService(db: Db) {

  async function getQuestions(programId: string): Promise<DiscoveryQuestion[]> {
    const rows = await db.select().from(discoveryQuestions)
      .where(eq(discoveryQuestions.onboardingProgramId, programId))
      .orderBy(asc(discoveryQuestions.sequence));
    return rows as unknown as DiscoveryQuestion[];
  }

  async function submitResponse(data: {
    participantId: string;
    questionId: string;
    rawText: string;
  }): Promise<DiscoveryResponse> {
    // Upsert: if a response already exists for this participant+question, update it
    const [existing] = await db.select().from(discoveryResponses)
      .where(and(
        eq(discoveryResponses.participantId, data.participantId),
        eq(discoveryResponses.questionId, data.questionId),
      ));

    if (existing) {
      const [row] = await db.update(discoveryResponses)
        .set({ rawText: data.rawText, updatedAt: new Date() })
        .where(eq(discoveryResponses.id, existing.id))
        .returning();
      return row as unknown as DiscoveryResponse;
    }

    const [row] = await db.insert(discoveryResponses).values({
      participantId: data.participantId,
      questionId: data.questionId,
      rawText: data.rawText,
    }).returning();
    return row as unknown as DiscoveryResponse;
  }

  async function getResponses(programId: string, participantId: string): Promise<DiscoveryResponse[]> {
    // Get all questions for this program, then join with responses
    const questions = await db.select().from(discoveryQuestions)
      .where(eq(discoveryQuestions.onboardingProgramId, programId));
    const questionIds = questions.map(q => q.id);

    if (questionIds.length === 0) return [];

    const rows = await db.select().from(discoveryResponses)
      .where(eq(discoveryResponses.participantId, participantId));

    // Filter to only responses for questions in this program
    const filtered = rows.filter(r => questionIds.includes(r.questionId));
    return filtered as unknown as DiscoveryResponse[];
  }

  async function seedQuestions(programId: string, questions: Array<{
    bucket: string;
    prompt: string;
    inputType?: string;
    required?: boolean;
    sequence: number;
  }>): Promise<DiscoveryQuestion[]> {
    const values = questions.map(q => ({
      onboardingProgramId: programId,
      bucket: q.bucket,
      prompt: q.prompt,
      inputType: q.inputType ?? "textarea",
      required: q.required ?? true,
      sequence: q.sequence,
    }));

    const rows = await db.insert(discoveryQuestions).values(values).returning();
    return rows as unknown as DiscoveryQuestion[];
  }

  async function getParticipantProgress(programId: string, participantId: string): Promise<{
    totalQuestions: number;
    answeredQuestions: number;
    isComplete: boolean;
  }> {
    const questions = await db.select().from(discoveryQuestions)
      .where(eq(discoveryQuestions.onboardingProgramId, programId));

    const responses = await db.select().from(discoveryResponses)
      .where(eq(discoveryResponses.participantId, participantId));

    const questionIds = new Set(questions.map(q => q.id));
    const answeredCount = responses.filter(r => questionIds.has(r.questionId)).length;

    return {
      totalQuestions: questions.length,
      answeredQuestions: answeredCount,
      isComplete: answeredCount >= questions.length && questions.length > 0,
    };
  }

  async function completeDiscovery(programId: string, participantId: string): Promise<{ completed: boolean }> {
    const progress = await getParticipantProgress(programId, participantId);
    if (!progress.isComplete) {
      return { completed: false };
    }

    await db.update(onboardingParticipants)
      .set({ status: "completed", completedAt: new Date(), updatedAt: new Date() })
      .where(and(
        eq(onboardingParticipants.id, participantId),
        eq(onboardingParticipants.onboardingProgramId, programId),
      ));

    return { completed: true };
  }

  return { getQuestions, submitResponse, getResponses, seedQuestions, getParticipantProgress, completeDiscovery };
}
