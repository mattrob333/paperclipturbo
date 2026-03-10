import { eq } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { sponsorIntakes } from "@paperclipai/db";
import type { SponsorIntake } from "@paperclipai/shared";
import { notFound, conflict } from "../errors.js";

export function sponsorIntakeService(db: Db) {

  async function createIntake(programId: string, data: {
    sponsorName: string;
    sponsorRole: string;
    currentPriorities?: string[];
    targetDepartments?: string[];
    deploymentPace?: string;
    riskTolerance?: string;
    currentAiUsage?: string[];
    desiredOutcomes?: string[];
    nonGoals?: string[];
    notes?: string;
  }): Promise<SponsorIntake> {
    // Check for existing intake
    const [existing] = await db.select().from(sponsorIntakes)
      .where(eq(sponsorIntakes.onboardingProgramId, programId));
    if (existing) throw conflict("Sponsor intake already exists for this program");

    const [row] = await db.insert(sponsorIntakes).values({
      onboardingProgramId: programId,
      sponsorName: data.sponsorName,
      sponsorRole: data.sponsorRole,
      currentPriorities: data.currentPriorities ?? [],
      targetDepartments: data.targetDepartments ?? [],
      deploymentPace: data.deploymentPace ?? null,
      riskTolerance: data.riskTolerance ?? null,
      currentAiUsage: data.currentAiUsage ?? [],
      desiredOutcomes: data.desiredOutcomes ?? [],
      nonGoals: data.nonGoals ?? [],
      notes: data.notes ?? null,
    }).returning();
    return row as unknown as SponsorIntake;
  }

  async function getIntake(programId: string): Promise<SponsorIntake> {
    const [row] = await db.select().from(sponsorIntakes)
      .where(eq(sponsorIntakes.onboardingProgramId, programId));
    if (!row) throw notFound("Sponsor intake not found");
    return row as unknown as SponsorIntake;
  }

  async function updateIntake(programId: string, data: {
    sponsorName?: string;
    sponsorRole?: string;
    currentPriorities?: string[];
    targetDepartments?: string[];
    deploymentPace?: string | null;
    riskTolerance?: string | null;
    currentAiUsage?: string[];
    desiredOutcomes?: string[];
    nonGoals?: string[];
    notes?: string | null;
  }): Promise<SponsorIntake> {
    const [row] = await db.update(sponsorIntakes)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(sponsorIntakes.onboardingProgramId, programId))
      .returning();
    if (!row) throw notFound("Sponsor intake not found");
    return row as unknown as SponsorIntake;
  }

  async function completeIntake(programId: string): Promise<SponsorIntake> {
    const [row] = await db.update(sponsorIntakes)
      .set({ completedAt: new Date(), updatedAt: new Date() })
      .where(eq(sponsorIntakes.onboardingProgramId, programId))
      .returning();
    if (!row) throw notFound("Sponsor intake not found");
    return row as unknown as SponsorIntake;
  }

  return { createIntake, getIntake, updateIntake, completeIntake };
}
