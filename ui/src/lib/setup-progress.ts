import type { ExperienceState } from "@paperclipai/shared";

export const SETUP_STEP_COUNT = 6;

export interface SetupStep {
  label: string;
  description: string;
}

export const SETUP_STEPS: SetupStep[] = [
  { label: "Executive Goals", description: "Define strategic objectives, risk posture, and pilot scope" },
  { label: "Team Setup", description: "Invite stakeholders who will participate in discovery" },
  { label: "Team Interviews", description: "Gather workflows, pain points, and readiness signals from your team" },
  { label: "Analysis", description: "Extract themes, contradictions, and opportunities from interview data" },
  { label: "Org Design Review", description: "Review and approve the hybrid human-AI team proposal" },
  { label: "Build & Deploy", description: "Generate agent workspaces and finalize team configuration" },
];

export const SETUP_STEP_CTAS: string[] = [
  "Define Executive Goals",
  "Add Team Members",
  "Begin Interviews",
  "Run Analysis",
  "Review Org Design",
  "Start Build",
];

export const SETUP_STEP_RECOMMENDATIONS: string[] = [
  "Define your executive goals to begin",
  "Add team members to continue",
  "Run team interviews to gather data",
  "Run analysis to extract insights",
  "Review and approve the org design",
  "Ready to build & deploy",
];

export type StepState = "completed" | "active" | "upcoming";

/**
 * Derives the current step index (0-5) from an ExperienceState.
 * This is the canonical mapping used across the UI.
 */
export function stepIndexFromExperienceState(state: ExperienceState): number {
  switch (state) {
    case "not_started":
    case "intake_in_progress":
      return 0;
    case "discovery_in_progress":
      return 2; // Steps 1 (team) and 2 (interviews) are both active during discovery
    case "synthesis_ready":
      return 3;
    case "proposal_ready":
      return 4;
    case "build_pending":
    case "building":
    case "build_failed":
      return 5;
    case "provisioned":
      return 6; // All complete
    default:
      return 0;
  }
}

/**
 * Derives per-step states from an ExperienceState.
 * Returns an array of 6 StepState values.
 */
export function stepStatesFromExperienceState(state: ExperienceState): StepState[] {
  switch (state) {
    case "not_started":
    case "intake_in_progress":
      return ["active", "upcoming", "upcoming", "upcoming", "upcoming", "upcoming"];
    case "discovery_in_progress":
      return ["completed", "active", "active", "upcoming", "upcoming", "upcoming"];
    case "synthesis_ready":
      return ["completed", "completed", "completed", "active", "upcoming", "upcoming"];
    case "proposal_ready":
      return ["completed", "completed", "completed", "completed", "active", "upcoming"];
    case "build_pending":
    case "building":
    case "build_failed":
      return ["completed", "completed", "completed", "completed", "completed", "active"];
    case "provisioned":
      return ["completed", "completed", "completed", "completed", "completed", "completed"];
    default:
      return ["active", "upcoming", "upcoming", "upcoming", "upcoming", "upcoming"];
  }
}

/**
 * Find the index of the first active step. Returns null if all complete.
 */
export function activeStepIndex(stepStates: StepState[]): number | null {
  const idx = stepStates.indexOf("active");
  return idx === -1 ? null : idx;
}
