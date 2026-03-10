import type { OnboardingProgram, SponsorIntake, OnboardingProposal } from "./onboarding.js";

// Experience states
export const EXPERIENCE_STATES = [
  "not_started", "intake_in_progress", "discovery_in_progress",
  "synthesis_ready", "proposal_ready", "build_pending",
  "building", "build_failed", "provisioned",
] as const;
export type ExperienceState = (typeof EXPERIENCE_STATES)[number];

// Build statuses
export const BUILD_STATUSES = [
  "queued", "compiling", "generating_workspaces", "validating",
  "provisioning", "completed", "failed",
] as const;
export type BuildStatus = (typeof BUILD_STATUSES)[number];

// Build log entry
export interface BuildLogEntry {
  timestamp: string;
  level: "info" | "warn" | "error";
  stage: string;
  message: string;
  detail?: string;
}

// Build run record (mirrors DB table)
export interface BuildRun {
  id: string;
  onboardingProgramId: string;
  status: BuildStatus;
  currentStage: string;
  stageProgress: number;
  agentCount: number;
  fileCount: number;
  validationPassed: boolean | null;
  errorMessage: string | null;
  log: BuildLogEntry[];
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// Experience state API response
export interface ExperienceStateInfo {
  state: ExperienceState;
  programId: string | null;
  programTitle: string | null;
  nextAction: string;
  nextActionPath: string;
  completedSteps: string[];
  buildRun: BuildRun | null;
}

// Build packet - business inputs
export interface BuildPacketBusinessInputs {
  companyName: string;
  companyDescription: string | null;
  sponsorName: string;
  sponsorRole: string;
  goals: string[];
  targetDepartments: string[];
  currentToolStack: string[];
  communicationChannels: string[];
  painPoints: string[];
  constraints: string[];
  riskTolerance: string;
  humanReviewBoundaries: string[];
  deploymentPace: string;
  desiredOutcomes: string[];
  nonGoals: string[];
}

// Build packet - analytical inputs
export interface BuildPacketAnalyticalInputs {
  synthesisArtifacts: {
    type: string;
    title: string;
    summary: string | null;
    payload: Record<string, unknown>;
    confidence: number | null;
  }[];
  approvedProposal: {
    topFindings: string[];
    hybridOrgSummary: string | null;
    humanLedBoundaries: string[];
    proposedAgentCount: number;
  };
}

// Build packet - technical inputs
export interface BuildPacketTechnicalInputs {
  targetWorkspaceContract: {
    rootPath: string;
    agentDirectoryPattern: string;
    requiredFiles: string[];
    optionalFiles: string[];
  };
  soulMdSections: string[];
  runtimeDefaults: {
    adapter: string;
    defaultModel: string;
    heartbeatMode: string;
    sandboxMode: boolean;
  };
}

// Complete build packet
export interface BuildPacket {
  version: string;
  programId: string;
  companyId: string;
  timestamp: string;
  business: BuildPacketBusinessInputs;
  analytical: BuildPacketAnalyticalInputs;
  technical: BuildPacketTechnicalInputs;
}

// Compiler output agent
export interface CompilerOutputAgent {
  slug: string;
  name: string;
  role: string;
  title: string;
  reportsToSlug: string | null;
  capabilities: string[];
  files: Record<string, string>;
}

// Compiler output
export interface CompilerOutput {
  version: string;
  programId: string;
  companySlug: string;
  agents: CompilerOutputAgent[];
  instanceManifest: string;
  validationReport: {
    passed: boolean;
    checks: { name: string; passed: boolean; message: string }[];
  };
  provisioningReport: {
    agentCount: number;
    fileCount: number;
    workspacePath: string;
  };
}

// Generated file node for build UI tree
export interface GeneratedFileNode {
  name: string;
  path: string;
  type: "file" | "directory";
  size?: number;
  children?: GeneratedFileNode[];
}

// --- Derive experience state ---

export interface ExperienceStateInput {
  program: OnboardingProgram | null;
  intake: SponsorIntake | null;
  participantCount: number;
  completedParticipantCount: number;
  responseCount: number;
  totalExpectedResponses: number;
  artifactCount: number;
  proposal: OnboardingProposal | null;
  buildRun: BuildRun | null;
}

export function deriveExperienceState(input: ExperienceStateInput): ExperienceState {
  const { program, intake, completedParticipantCount, responseCount, artifactCount, proposal, buildRun } = input;

  if (!program) return "not_started";
  if (program.status === "complete") return "provisioned";

  // Build states take priority
  if (buildRun) {
    if (buildRun.status === "completed") return "provisioned";
    if (buildRun.status === "failed") return "build_failed";
    return "building";
  }

  // Proposal states
  if (proposal) {
    if (proposal.status === "provisioning_approved" || proposal.status === "org_approved") return "build_pending";
    if (proposal.status !== "draft") return "proposal_ready";
  }

  // Synthesis
  if (artifactCount > 0) return "synthesis_ready";

  // Discovery
  if (responseCount > 0 || completedParticipantCount > 0) return "discovery_in_progress";

  // Intake
  if (intake?.completedAt) return "discovery_in_progress";
  if (!intake) return "intake_in_progress";

  // Intake exists but not completed
  return "intake_in_progress";
}
