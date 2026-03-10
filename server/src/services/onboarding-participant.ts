import { eq, and } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { onboardingParticipants } from "@paperclipai/db";
import type { OnboardingParticipant } from "@paperclipai/shared";
import { notFound } from "../errors.js";

export function participantService(db: Db) {

  async function addParticipant(programId: string, data: {
    name: string;
    email: string;
    title?: string;
    department?: string;
    managerParticipantId?: string;
  }): Promise<OnboardingParticipant> {
    const [row] = await db.insert(onboardingParticipants).values({
      onboardingProgramId: programId,
      name: data.name,
      email: data.email,
      title: data.title ?? null,
      department: data.department ?? null,
      managerParticipantId: data.managerParticipantId ?? null,
    }).returning();
    return row as unknown as OnboardingParticipant;
  }

  async function listParticipants(programId: string): Promise<OnboardingParticipant[]> {
    const rows = await db.select().from(onboardingParticipants)
      .where(eq(onboardingParticipants.onboardingProgramId, programId));
    return rows as unknown as OnboardingParticipant[];
  }

  async function updateParticipant(programId: string, participantId: string, data: {
    name?: string;
    email?: string;
    title?: string | null;
    department?: string | null;
    managerParticipantId?: string | null;
    status?: string;
  }): Promise<OnboardingParticipant> {
    const [row] = await db.update(onboardingParticipants)
      .set({ ...data, updatedAt: new Date() })
      .where(and(
        eq(onboardingParticipants.id, participantId),
        eq(onboardingParticipants.onboardingProgramId, programId),
      ))
      .returning();
    if (!row) throw notFound("Participant not found");
    return row as unknown as OnboardingParticipant;
  }

  async function removeParticipant(programId: string, participantId: string): Promise<void> {
    const result = await db.delete(onboardingParticipants)
      .where(and(
        eq(onboardingParticipants.id, participantId),
        eq(onboardingParticipants.onboardingProgramId, programId),
      ))
      .returning();
    if (result.length === 0) throw notFound("Participant not found");
  }

  return { addParticipant, listParticipants, updateParticipant, removeParticipant };
}
