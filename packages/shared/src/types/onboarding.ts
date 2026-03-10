// --- Status/Phase unions ---

export const ONBOARDING_PROGRAM_STATUSES = [
  "draft", "intake", "discovery", "synthesis", "proposal", "approved", "provisioning", "complete",
] as const;
export type OnboardingProgramStatus = (typeof ONBOARDING_PROGRAM_STATUSES)[number];

export const ONBOARDING_PROGRAM_PHASES = [
  "sponsor_intake", "participant_invite", "discovery", "synthesis", "workshop", "proposal", "provisioning",
] as const;
export type OnboardingProgramPhase = (typeof ONBOARDING_PROGRAM_PHASES)[number];

export const PARTICIPANT_STATUSES = ["invited", "active", "completed", "declined"] as const;
export type ParticipantStatus = (typeof PARTICIPANT_STATUSES)[number];

export const DEPLOYMENT_PACES = ["aggressive", "moderate", "conservative"] as const;
export type DeploymentPace = (typeof DEPLOYMENT_PACES)[number];

export const RISK_TOLERANCES = ["high", "medium", "low"] as const;
export type RiskTolerance = (typeof RISK_TOLERANCES)[number];

export const DISCOVERY_INPUT_TYPES = ["text", "textarea", "select"] as const;
export type DiscoveryInputType = (typeof DISCOVERY_INPUT_TYPES)[number];

export const DISCOVERY_BUCKETS = [
  "role_and_responsibilities", "daily_workflow", "collaboration", "pain_points", "ai_readiness",
] as const;
export type DiscoveryBucket = (typeof DISCOVERY_BUCKETS)[number];

export const SENTIMENT_VALUES = ["positive", "neutral", "negative", "mixed"] as const;
export type Sentiment = (typeof SENTIMENT_VALUES)[number];

export const SYNTHESIS_ARTIFACT_TYPES = [
  "theme_summary", "contradiction_report", "workflow_map", "bottleneck_analysis", "opportunity_assessment", "full_synthesis",
] as const;
export type SynthesisArtifactType = (typeof SYNTHESIS_ARTIFACT_TYPES)[number];

export const PROPOSAL_STATUSES = [
  "draft", "pending_review", "findings_approved", "org_approved", "provisioning_approved", "revision_requested",
] as const;
export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number];

// --- Entity interfaces ---

export interface OnboardingProgram {
  id: string;
  companyId: string;
  status: OnboardingProgramStatus;
  phase: OnboardingProgramPhase;
  title: string | null;
  schemaVersion: number;
  createdAt: string;
  updatedAt: string;
}

export interface SponsorIntake {
  id: string;
  onboardingProgramId: string;
  sponsorName: string;
  sponsorRole: string;
  currentPriorities: string[];
  targetDepartments: string[];
  deploymentPace: DeploymentPace | null;
  riskTolerance: RiskTolerance | null;
  currentAiUsage: string[];
  desiredOutcomes: string[];
  nonGoals: string[];
  notes: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OnboardingParticipant {
  id: string;
  onboardingProgramId: string;
  name: string;
  email: string;
  title: string | null;
  department: string | null;
  managerParticipantId: string | null;
  status: ParticipantStatus;
  invitedAt: string;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DiscoveryQuestion {
  id: string;
  onboardingProgramId: string;
  bucket: DiscoveryBucket;
  prompt: string;
  inputType: DiscoveryInputType;
  required: boolean;
  sequence: number;
  followupRules: Record<string, unknown>[];
  createdAt: string;
}

export interface DiscoveryResponse {
  id: string;
  participantId: string;
  questionId: string;
  rawText: string;
  normalizedTags: string[];
  inferredCapabilities: string[];
  inferredTaskTypes: string[];
  inferredDependencies: string[];
  sentiment: Sentiment | null;
  confidence: number | null;
  evidenceRefs: string[];
  createdAt: string;
  updatedAt: string;
}

export interface SynthesisArtifact {
  id: string;
  onboardingProgramId: string;
  artifactType: SynthesisArtifactType;
  title: string;
  summary: string | null;
  payloadJson: Record<string, unknown>;
  confidenceSummary: number | null;
  generatedAt: string;
  createdAt: string;
}

export interface OnboardingProposal {
  id: string;
  onboardingProgramId: string;
  version: number;
  status: ProposalStatus;
  topFindings: string[];
  hybridOrgSummary: string | null;
  proposedAgentIds: string[];
  pairingIds: string[];
  rolloutPhaseIds: string[];
  humanLedBoundaries: string[];
  revisionNotes: string[];
  createdAt: string;
  updatedAt: string;
}

// --- Summary/Dashboard types ---

export interface OnboardingProgramDetail {
  program: OnboardingProgram;
  intake: SponsorIntake | null;
  participantCount: number;
  completedParticipantCount: number;
  questionCount: number;
  totalResponseCount: number;
  synthesisArtifactCount: number;
  proposal: OnboardingProposal | null;
}

export interface OnboardingProgramSummary {
  id: string;
  companyId: string;
  status: OnboardingProgramStatus;
  phase: OnboardingProgramPhase;
  title: string | null;
  participantCount: number;
  completedParticipantCount: number;
  hasIntake: boolean;
  hasSynthesis: boolean;
  hasProposal: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OnboardingProgramProgress {
  programId: string;
  phase: OnboardingProgramPhase;
  status: OnboardingProgramStatus;
  intakeComplete: boolean;
  participantCount: number;
  participantsInvited: number;
  participantsActive: number;
  participantsCompleted: number;
  totalQuestions: number;
  totalResponses: number;
  discoveryCompletionPercent: number;
  synthesisReady: boolean;
  proposalReady: boolean;
  nextRecommendedAction: string;
}
