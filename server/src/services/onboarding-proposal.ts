import { eq, desc } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { onboardingProposals, synthesisArtifacts } from "@paperclipai/db";
import type { OnboardingProposal, ProposalStatus } from "@paperclipai/shared";
import { notFound, badRequest } from "../errors.js";

export function proposalService(db: Db) {

  async function generateProposal(programId: string): Promise<OnboardingProposal> {
    // Read all synthesis artifacts for this program
    const artifacts = await db.select().from(synthesisArtifacts)
      .where(eq(synthesisArtifacts.onboardingProgramId, programId));

    if (artifacts.length === 0) {
      throw badRequest("No synthesis artifacts found. Run synthesis first.");
    }

    const topFindings: string[] = [];
    let hybridOrgSummary = "";
    const humanLedBoundaries: string[] = [];

    for (const artifact of artifacts) {
      const payload = artifact.payloadJson as Record<string, unknown>;

      if (artifact.artifactType === "theme_summary") {
        const themes = payload.themes as { name: string; bucket: string; frequency: number }[] | undefined;
        if (themes) {
          const top3 = themes.slice(0, 3);
          for (const t of top3) {
            topFindings.push(`Theme "${t.name}" in ${t.bucket} (mentioned ${t.frequency} times)`);
          }
        }
      }

      if (artifact.artifactType === "contradiction_report") {
        const contradictions = payload.contradictions as { questionId: string; summaryA: string; summaryB: string }[] | undefined;
        if (contradictions) {
          for (const c of contradictions) {
            topFindings.push(`Contradiction detected: "${c.summaryA.slice(0, 50)}..." vs "${c.summaryB.slice(0, 50)}..."`);
          }
        }
      }

      if (artifact.artifactType === "bottleneck_analysis") {
        const bottlenecks = payload.bottlenecks as { description: string; frequency: number; severity: string }[] | undefined;
        if (bottlenecks) {
          for (const b of bottlenecks) {
            topFindings.push(`Bottleneck: ${b.description} (${b.severity} severity, ${b.frequency} mentions)`);
          }
        }
      }

      if (artifact.artifactType === "opportunity_assessment") {
        const opportunities = payload.opportunities as {
          area: string;
          rationale: string;
          readinessScore: number;
          impactEstimate: string;
        }[] | undefined;
        if (opportunities) {
          const parts: string[] = [];
          for (const o of opportunities) {
            parts.push(`${o.area} (impact: ${o.impactEstimate}, readiness: ${(o.readinessScore * 100).toFixed(0)}%)`);
            if (o.readinessScore < 0.3) {
              humanLedBoundaries.push(`${o.area}: low AI readiness (${(o.readinessScore * 100).toFixed(0)}%) - recommend human-led`);
            }
          }
          hybridOrgSummary = `Opportunity areas: ${parts.join("; ")}.`;
        }
      }
    }

    // Get current max version
    const existing = await db.select().from(onboardingProposals)
      .where(eq(onboardingProposals.onboardingProgramId, programId))
      .orderBy(desc(onboardingProposals.version));

    const nextVersion = existing.length > 0 ? existing[0].version + 1 : 1;

    const [row] = await db.insert(onboardingProposals).values({
      onboardingProgramId: programId,
      version: nextVersion,
      status: "draft",
      topFindings,
      hybridOrgSummary: hybridOrgSummary || null,
      humanLedBoundaries,
    }).returning();

    return row as unknown as OnboardingProposal;
  }

  async function getProposal(programId: string): Promise<OnboardingProposal | null> {
    const [row] = await db.select().from(onboardingProposals)
      .where(eq(onboardingProposals.onboardingProgramId, programId))
      .orderBy(desc(onboardingProposals.version))
      .limit(1);
    return row ? (row as unknown as OnboardingProposal) : null;
  }

  async function getProposalHistory(programId: string): Promise<OnboardingProposal[]> {
    const rows = await db.select().from(onboardingProposals)
      .where(eq(onboardingProposals.onboardingProgramId, programId))
      .orderBy(desc(onboardingProposals.version));
    return rows as unknown as OnboardingProposal[];
  }

  async function updateProposalStatus(
    programId: string,
    proposalId: string,
    status: ProposalStatus,
    revisionNotes?: string,
  ): Promise<OnboardingProposal> {
    const [existing] = await db.select().from(onboardingProposals)
      .where(eq(onboardingProposals.id, proposalId));

    if (!existing) throw notFound("Proposal not found");
    if (existing.onboardingProgramId !== programId) throw notFound("Proposal not found");

    const currentNotes = (existing.revisionNotes ?? []) as string[];
    const updatedNotes = revisionNotes ? [...currentNotes, revisionNotes] : currentNotes;

    const [row] = await db.update(onboardingProposals)
      .set({
        status,
        revisionNotes: updatedNotes,
        updatedAt: new Date(),
      })
      .where(eq(onboardingProposals.id, proposalId))
      .returning();

    return row as unknown as OnboardingProposal;
  }

  return { generateProposal, getProposal, getProposalHistory, updateProposalStatus };
}
