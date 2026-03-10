import { describe, it, expect } from "vitest";
import { deriveExperienceState } from "@paperclipai/shared";

describe("deriveExperienceState", () => {
  const baseInput = {
    program: null,
    intake: null,
    participantCount: 0,
    completedParticipantCount: 0,
    responseCount: 0,
    totalExpectedResponses: 0,
    artifactCount: 0,
    proposal: null,
    buildRun: null,
  };

  it("returns not_started when no program", () => {
    expect(deriveExperienceState(baseInput)).toBe("not_started");
  });

  it("returns intake_in_progress for draft program with no intake", () => {
    expect(deriveExperienceState({
      ...baseInput,
      program: { status: "draft", phase: "sponsor_intake" } as any,
    })).toBe("intake_in_progress");
  });

  it("returns intake_in_progress when intake exists but not complete", () => {
    expect(deriveExperienceState({
      ...baseInput,
      program: { status: "intake", phase: "sponsor_intake" } as any,
      intake: { completedAt: null } as any,
    })).toBe("intake_in_progress");
  });

  it("returns discovery_in_progress when intake complete", () => {
    expect(deriveExperienceState({
      ...baseInput,
      program: { status: "discovery", phase: "discovery" } as any,
      intake: { completedAt: "2025-01-01" } as any,
    })).toBe("discovery_in_progress");
  });

  it("returns synthesis_ready when artifacts exist", () => {
    expect(deriveExperienceState({
      ...baseInput,
      program: { status: "synthesis", phase: "synthesis" } as any,
      intake: { completedAt: "2025-01-01" } as any,
      artifactCount: 6,
    })).toBe("synthesis_ready");
  });

  it("returns proposal_ready when proposal is pending review", () => {
    expect(deriveExperienceState({
      ...baseInput,
      program: { status: "proposal", phase: "proposal" } as any,
      intake: { completedAt: "2025-01-01" } as any,
      artifactCount: 6,
      proposal: { status: "pending_review" } as any,
    })).toBe("proposal_ready");
  });

  it("returns build_pending when proposal is org_approved", () => {
    expect(deriveExperienceState({
      ...baseInput,
      program: { status: "approved", phase: "provisioning" } as any,
      intake: { completedAt: "2025-01-01" } as any,
      artifactCount: 6,
      proposal: { status: "org_approved" } as any,
    })).toBe("build_pending");
  });

  it("returns building when build run is active", () => {
    expect(deriveExperienceState({
      ...baseInput,
      program: { status: "provisioning", phase: "provisioning" } as any,
      intake: { completedAt: "2025-01-01" } as any,
      artifactCount: 6,
      proposal: { status: "provisioning_approved" } as any,
      buildRun: { status: "compiling" } as any,
    })).toBe("building");
  });

  it("returns build_failed when build failed", () => {
    expect(deriveExperienceState({
      ...baseInput,
      program: { status: "provisioning", phase: "provisioning" } as any,
      buildRun: { status: "failed" } as any,
    })).toBe("build_failed");
  });

  it("returns provisioned when program is complete", () => {
    expect(deriveExperienceState({
      ...baseInput,
      program: { status: "complete", phase: "provisioning" } as any,
    })).toBe("provisioned");
  });
});
