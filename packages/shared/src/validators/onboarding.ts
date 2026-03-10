import { z } from "zod";

// --- Create/Update schemas for OnboardingProgram ---

export const createOnboardingProgramSchema = z.object({
  companyId: z.string().uuid(),
  title: z.string().min(1).optional(),
});

export type CreateOnboardingProgram = z.infer<typeof createOnboardingProgramSchema>;

export const updateOnboardingProgramSchema = z.object({
  status: z.enum(["draft", "intake", "discovery", "synthesis", "proposal", "approved", "provisioning", "complete"]).optional(),
  phase: z.enum(["sponsor_intake", "participant_invite", "discovery", "synthesis", "workshop", "proposal", "provisioning"]).optional(),
  title: z.string().min(1).optional(),
});

export type UpdateOnboardingProgram = z.infer<typeof updateOnboardingProgramSchema>;

// --- Create/Update schemas for SponsorIntake ---

export const createSponsorIntakeSchema = z.object({
  sponsorName: z.string().min(1),
  sponsorRole: z.string().min(1),
  currentPriorities: z.array(z.string()).optional().default([]),
  targetDepartments: z.array(z.string()).optional().default([]),
  deploymentPace: z.enum(["aggressive", "moderate", "conservative"]).optional(),
  riskTolerance: z.enum(["high", "medium", "low"]).optional(),
  currentAiUsage: z.array(z.string()).optional().default([]),
  desiredOutcomes: z.array(z.string()).optional().default([]),
  nonGoals: z.array(z.string()).optional().default([]),
  notes: z.string().optional(),
});

export type CreateSponsorIntake = z.infer<typeof createSponsorIntakeSchema>;

export const updateSponsorIntakeSchema = createSponsorIntakeSchema.partial();

export type UpdateSponsorIntake = z.infer<typeof updateSponsorIntakeSchema>;

// --- Create/Update schemas for Participant ---

export const createParticipantSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  title: z.string().optional(),
  department: z.string().optional(),
  managerParticipantId: z.string().uuid().optional(),
});

export type CreateParticipant = z.infer<typeof createParticipantSchema>;

export const updateParticipantSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  title: z.string().optional(),
  department: z.string().optional(),
  managerParticipantId: z.string().uuid().nullable().optional(),
  status: z.enum(["invited", "active", "completed", "declined"]).optional(),
});

export type UpdateParticipant = z.infer<typeof updateParticipantSchema>;

// --- Submit discovery response schema ---

export const submitDiscoveryResponseSchema = z.object({
  participantId: z.string().uuid(),
  questionId: z.string().uuid(),
  rawText: z.string().min(1),
});

export type SubmitDiscoveryResponse = z.infer<typeof submitDiscoveryResponseSchema>;

// --- Synthesis run schema ---
export const runSynthesisSchema = z.object({
  artifactTypes: z.array(z.enum([
    "theme_summary", "contradiction_report", "workflow_map",
    "bottleneck_analysis", "opportunity_assessment", "full_synthesis",
  ])).optional(),
});
export type RunSynthesis = z.infer<typeof runSynthesisSchema>;

// --- Proposal schemas ---
export const generateProposalSchema = z.object({
  version: z.number().int().positive().optional(),
});
export type GenerateProposal = z.infer<typeof generateProposalSchema>;

export const updateProposalStatusSchema = z.object({
  status: z.enum([
    "draft", "pending_review", "findings_approved", "org_approved",
    "provisioning_approved", "revision_requested",
  ]),
  revisionNotes: z.string().optional(),
});
export type UpdateProposalStatus = z.infer<typeof updateProposalStatusSchema>;
