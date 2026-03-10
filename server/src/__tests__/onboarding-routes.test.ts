import { describe, it, expect } from "vitest";
import {
  createOnboardingProgramSchema,
  updateOnboardingProgramSchema,
  createSponsorIntakeSchema,
  updateSponsorIntakeSchema,
  createParticipantSchema,
  updateParticipantSchema,
  submitDiscoveryResponseSchema,
  runSynthesisSchema,
  generateProposalSchema,
  updateProposalStatusSchema,
} from "@paperclipai/shared";

describe("Onboarding validators", () => {
  describe("createOnboardingProgramSchema", () => {
    it("accepts valid program creation", () => {
      const result = createOnboardingProgramSchema.safeParse({
        companyId: "550e8400-e29b-41d4-a716-446655440000",
      });
      expect(result.success).toBe(true);
    });

    it("accepts program with optional title", () => {
      const result = createOnboardingProgramSchema.safeParse({
        companyId: "550e8400-e29b-41d4-a716-446655440000",
        title: "Marketing Team Onboarding",
      });
      expect(result.success).toBe(true);
    });

    it("rejects missing companyId", () => {
      const result = createOnboardingProgramSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it("rejects invalid UUID for companyId", () => {
      const result = createOnboardingProgramSchema.safeParse({
        companyId: "not-a-uuid",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("updateOnboardingProgramSchema", () => {
    it("accepts valid status update", () => {
      const result = updateOnboardingProgramSchema.safeParse({
        status: "discovery",
      });
      expect(result.success).toBe(true);
    });

    it("accepts valid phase update", () => {
      const result = updateOnboardingProgramSchema.safeParse({
        phase: "participant_invite",
      });
      expect(result.success).toBe(true);
    });

    it("rejects invalid status value", () => {
      const result = updateOnboardingProgramSchema.safeParse({
        status: "invalid_status",
      });
      expect(result.success).toBe(false);
    });

    it("rejects invalid phase value", () => {
      const result = updateOnboardingProgramSchema.safeParse({
        phase: "invalid_phase",
      });
      expect(result.success).toBe(false);
    });

    it("accepts empty object (no fields required)", () => {
      const result = updateOnboardingProgramSchema.safeParse({});
      expect(result.success).toBe(true);
    });
  });

  describe("createSponsorIntakeSchema", () => {
    it("accepts minimal valid intake", () => {
      const result = createSponsorIntakeSchema.safeParse({
        sponsorName: "Jane CEO",
        sponsorRole: "Chief Executive Officer",
      });
      expect(result.success).toBe(true);
    });

    it("accepts full intake with all fields", () => {
      const result = createSponsorIntakeSchema.safeParse({
        sponsorName: "Jane CEO",
        sponsorRole: "CEO",
        currentPriorities: ["revenue growth", "team expansion"],
        targetDepartments: ["engineering", "marketing"],
        deploymentPace: "moderate",
        riskTolerance: "medium",
        currentAiUsage: ["ChatGPT for drafts"],
        desiredOutcomes: ["faster content production"],
        nonGoals: ["replacing human managers"],
        notes: "Pilot first with marketing",
      });
      expect(result.success).toBe(true);
    });

    it("rejects missing sponsor name", () => {
      const result = createSponsorIntakeSchema.safeParse({
        sponsorRole: "CEO",
      });
      expect(result.success).toBe(false);
    });

    it("rejects invalid deployment pace", () => {
      const result = createSponsorIntakeSchema.safeParse({
        sponsorName: "Jane",
        sponsorRole: "CEO",
        deploymentPace: "lightning",
      });
      expect(result.success).toBe(false);
    });

    it("rejects invalid risk tolerance", () => {
      const result = createSponsorIntakeSchema.safeParse({
        sponsorName: "Jane",
        sponsorRole: "CEO",
        riskTolerance: "extreme",
      });
      expect(result.success).toBe(false);
    });

    it("defaults arrays to empty when omitted", () => {
      const result = createSponsorIntakeSchema.safeParse({
        sponsorName: "Jane",
        sponsorRole: "CEO",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.currentPriorities).toEqual([]);
        expect(result.data.targetDepartments).toEqual([]);
        expect(result.data.currentAiUsage).toEqual([]);
        expect(result.data.desiredOutcomes).toEqual([]);
        expect(result.data.nonGoals).toEqual([]);
      }
    });
  });

  describe("updateSponsorIntakeSchema", () => {
    it("accepts partial update", () => {
      const result = updateSponsorIntakeSchema.safeParse({
        notes: "Updated notes",
      });
      expect(result.success).toBe(true);
    });

    it("accepts empty object", () => {
      const result = updateSponsorIntakeSchema.safeParse({});
      expect(result.success).toBe(true);
    });
  });

  describe("createParticipantSchema", () => {
    it("accepts valid participant", () => {
      const result = createParticipantSchema.safeParse({
        name: "Alice Smith",
        email: "alice@example.com",
      });
      expect(result.success).toBe(true);
    });

    it("accepts participant with optional fields", () => {
      const result = createParticipantSchema.safeParse({
        name: "Alice Smith",
        email: "alice@example.com",
        title: "Marketing Manager",
        department: "Marketing",
        managerParticipantId: "550e8400-e29b-41d4-a716-446655440000",
      });
      expect(result.success).toBe(true);
    });

    it("rejects missing name", () => {
      const result = createParticipantSchema.safeParse({
        email: "alice@example.com",
      });
      expect(result.success).toBe(false);
    });

    it("rejects invalid email", () => {
      const result = createParticipantSchema.safeParse({
        name: "Alice",
        email: "not-an-email",
      });
      expect(result.success).toBe(false);
    });

    it("rejects invalid UUID for managerParticipantId", () => {
      const result = createParticipantSchema.safeParse({
        name: "Alice",
        email: "alice@example.com",
        managerParticipantId: "bad-uuid",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("updateParticipantSchema", () => {
    it("accepts status update", () => {
      const result = updateParticipantSchema.safeParse({
        status: "active",
      });
      expect(result.success).toBe(true);
    });

    it("accepts nullable managerParticipantId", () => {
      const result = updateParticipantSchema.safeParse({
        managerParticipantId: null,
      });
      expect(result.success).toBe(true);
    });

    it("rejects invalid status", () => {
      const result = updateParticipantSchema.safeParse({
        status: "invalid",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("submitDiscoveryResponseSchema", () => {
    it("accepts valid discovery response", () => {
      const result = submitDiscoveryResponseSchema.safeParse({
        participantId: "550e8400-e29b-41d4-a716-446655440000",
        questionId: "660e8400-e29b-41d4-a716-446655440000",
        rawText: "I manage the marketing team and handle campaign strategy.",
      });
      expect(result.success).toBe(true);
    });

    it("rejects empty rawText", () => {
      const result = submitDiscoveryResponseSchema.safeParse({
        participantId: "550e8400-e29b-41d4-a716-446655440000",
        questionId: "660e8400-e29b-41d4-a716-446655440000",
        rawText: "",
      });
      expect(result.success).toBe(false);
    });

    it("rejects missing participantId", () => {
      const result = submitDiscoveryResponseSchema.safeParse({
        questionId: "660e8400-e29b-41d4-a716-446655440000",
        rawText: "Some answer",
      });
      expect(result.success).toBe(false);
    });

    it("rejects invalid UUID", () => {
      const result = submitDiscoveryResponseSchema.safeParse({
        participantId: "not-uuid",
        questionId: "660e8400-e29b-41d4-a716-446655440000",
        rawText: "Some answer",
      });
      expect(result.success).toBe(false);
    });
  });
});

describe("Phase 2 - Synthesis & Proposal validators", () => {
  describe("runSynthesisSchema", () => {
    it("accepts empty body (all artifact types)", () => {
      const result = runSynthesisSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it("accepts specific artifact types", () => {
      const result = runSynthesisSchema.safeParse({
        artifactTypes: ["theme_summary", "contradiction_report"],
      });
      expect(result.success).toBe(true);
    });

    it("accepts all 6 artifact types", () => {
      const result = runSynthesisSchema.safeParse({
        artifactTypes: [
          "theme_summary", "contradiction_report", "workflow_map",
          "bottleneck_analysis", "opportunity_assessment", "full_synthesis",
        ],
      });
      expect(result.success).toBe(true);
    });

    it("rejects invalid artifact type", () => {
      const result = runSynthesisSchema.safeParse({
        artifactTypes: ["invalid_type"],
      });
      expect(result.success).toBe(false);
    });

    it("rejects non-array artifactTypes", () => {
      const result = runSynthesisSchema.safeParse({
        artifactTypes: "theme_summary",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("generateProposalSchema", () => {
    it("accepts empty body", () => {
      const result = generateProposalSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it("accepts optional version", () => {
      const result = generateProposalSchema.safeParse({ version: 2 });
      expect(result.success).toBe(true);
    });

    it("rejects non-positive version", () => {
      const result = generateProposalSchema.safeParse({ version: 0 });
      expect(result.success).toBe(false);
    });

    it("rejects non-integer version", () => {
      const result = generateProposalSchema.safeParse({ version: 1.5 });
      expect(result.success).toBe(false);
    });
  });

  describe("updateProposalStatusSchema", () => {
    it("accepts valid status transition", () => {
      const result = updateProposalStatusSchema.safeParse({
        status: "pending_review",
      });
      expect(result.success).toBe(true);
    });

    it("accepts all valid statuses", () => {
      const statuses = [
        "draft", "pending_review", "findings_approved",
        "org_approved", "provisioning_approved", "revision_requested",
      ];
      for (const status of statuses) {
        const result = updateProposalStatusSchema.safeParse({ status });
        expect(result.success).toBe(true);
      }
    });

    it("accepts status with revision notes", () => {
      const result = updateProposalStatusSchema.safeParse({
        status: "revision_requested",
        revisionNotes: "Please reconsider the agent roster",
      });
      expect(result.success).toBe(true);
    });

    it("rejects missing status", () => {
      const result = updateProposalStatusSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it("rejects invalid status", () => {
      const result = updateProposalStatusSchema.safeParse({
        status: "invalid_status",
      });
      expect(result.success).toBe(false);
    });

    it("rejects revision notes without status", () => {
      const result = updateProposalStatusSchema.safeParse({
        revisionNotes: "Some notes",
      });
      expect(result.success).toBe(false);
    });
  });
});

describe("Discovery seed questions", () => {
  it("has 20 questions across 5 buckets", async () => {
    const { DEFAULT_DISCOVERY_QUESTIONS } = await import("../seed/discovery-questions.js");
    expect(DEFAULT_DISCOVERY_QUESTIONS).toHaveLength(20);

    const buckets = new Set(DEFAULT_DISCOVERY_QUESTIONS.map(q => q.bucket));
    expect(buckets.size).toBe(5);
    expect(buckets).toContain("role_and_responsibilities");
    expect(buckets).toContain("daily_workflow");
    expect(buckets).toContain("collaboration");
    expect(buckets).toContain("pain_points");
    expect(buckets).toContain("ai_readiness");
  });

  it("has 4 questions per bucket", async () => {
    const { DEFAULT_DISCOVERY_QUESTIONS } = await import("../seed/discovery-questions.js");
    const bucketsMap: Record<string, number> = {};
    for (const q of DEFAULT_DISCOVERY_QUESTIONS) {
      bucketsMap[q.bucket] = (bucketsMap[q.bucket] || 0) + 1;
    }
    for (const count of Object.values(bucketsMap)) {
      expect(count).toBe(4);
    }
  });

  it("has sequential sequence numbers", async () => {
    const { DEFAULT_DISCOVERY_QUESTIONS } = await import("../seed/discovery-questions.js");
    const sequences = DEFAULT_DISCOVERY_QUESTIONS.map(q => q.sequence);
    for (let i = 0; i < sequences.length; i++) {
      expect(sequences[i]).toBe(i + 1);
    }
  });

  it("all questions have required fields", async () => {
    const { DEFAULT_DISCOVERY_QUESTIONS } = await import("../seed/discovery-questions.js");
    for (const q of DEFAULT_DISCOVERY_QUESTIONS) {
      expect(q.bucket).toBeTruthy();
      expect(q.prompt).toBeTruthy();
      expect(q.inputType).toBeTruthy();
      expect(typeof q.required).toBe("boolean");
      expect(typeof q.sequence).toBe("number");
    }
  });
});
