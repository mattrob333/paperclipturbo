import { describe, it, expect } from "vitest";
import {
  PROVISIONING_PHASES,
  PROVISIONING_JOB_STATUSES,
  COMPANY_LIFECYCLE_STATUSES,
  PROVISIONING_PHASE_LABELS,
  PROVISIONING_PHASE_DESCRIPTIONS,
  startProvisioningSchema,
  retryProvisioningSchema,
} from "@paperclipai/shared";
import { workspaceInitializerService } from "../services/workspace-initializer.js";
import { instanceReadinessService } from "../services/instance-readiness.js";

describe("provisioning types and constants", () => {
  it("has 7 provisioning phases", () => {
    expect(PROVISIONING_PHASES).toHaveLength(7);
  });

  it("has 4 job statuses", () => {
    expect(PROVISIONING_JOB_STATUSES).toHaveLength(4);
  });

  it("has 6 company lifecycle statuses", () => {
    expect(COMPANY_LIFECYCLE_STATUSES).toHaveLength(6);
  });

  it("has labels for all phases", () => {
    for (const phase of PROVISIONING_PHASES) {
      expect(PROVISIONING_PHASE_LABELS[phase]).toBeDefined();
      expect(typeof PROVISIONING_PHASE_LABELS[phase]).toBe("string");
    }
  });

  it("has descriptions for all phases", () => {
    for (const phase of PROVISIONING_PHASES) {
      expect(PROVISIONING_PHASE_DESCRIPTIONS[phase]).toBeDefined();
      expect(typeof PROVISIONING_PHASE_DESCRIPTIONS[phase]).toBe("string");
    }
  });
});

describe("provisioning validators", () => {
  it("accepts valid start input with name only", () => {
    const result = startProvisioningSchema.safeParse({ companyName: "Test Co" });
    expect(result.success).toBe(true);
  });

  it("accepts valid start input with all fields", () => {
    const result = startProvisioningSchema.safeParse({
      companyName: "Test Co",
      companyDescription: "A test company",
      workspaceRoot: "/workspace",
      gatewayUrl: "http://localhost:18789",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty company name", () => {
    const result = startProvisioningSchema.safeParse({ companyName: "" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid gateway URL", () => {
    const result = startProvisioningSchema.safeParse({
      companyName: "Test Co",
      gatewayUrl: "not-a-url",
    });
    expect(result.success).toBe(false);
  });

  it("accepts empty retry input", () => {
    const result = retryProvisioningSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts valid retry phase", () => {
    const result = retryProvisioningSchema.safeParse({ fromPhase: "workspace_init" });
    expect(result.success).toBe(true);
  });

  it("rejects invalid retry phase", () => {
    const result = retryProvisioningSchema.safeParse({ fromPhase: "invalid_phase" });
    expect(result.success).toBe(false);
  });
});

describe("workspace initializer", () => {
  it("reports baseline exists", () => {
    const init = workspaceInitializerService();
    expect(init.baselineExists()).toBe(true);
  });

  it("baseline dir path ends with openclaw-baseline", () => {
    const init = workspaceInitializerService();
    expect(init.getBaselineDir()).toMatch(/openclaw-baseline$/);
  });
});

describe("provisioning sequencing guarantees", () => {

  describe("generation-before-activation invariant", () => {
    it("should have generation phase before activation phase in PROVISIONING_PHASES", () => {
      const genIdx = PROVISIONING_PHASES.indexOf("generation");
      const actIdx = PROVISIONING_PHASES.indexOf("activation");
      expect(genIdx).toBeLessThan(actIdx);
      expect(genIdx).toBeGreaterThan(-1);
      expect(actIdx).toBeGreaterThan(-1);
    });

    it("should include generation in the phase labels and descriptions", () => {
      expect(PROVISIONING_PHASE_LABELS.generation).toBeDefined();
      expect(PROVISIONING_PHASE_LABELS.generation).toContain("Generat");
      expect(PROVISIONING_PHASE_DESCRIPTIONS.generation).toBeDefined();
    });
  });

  describe("retry semantics", () => {
    it("retryProvisioningSchema should accept valid retry input", () => {
      const result = retryProvisioningSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it("retryProvisioningSchema should accept fromPhase parameter", () => {
      const result = retryProvisioningSchema.safeParse({ fromPhase: "generation" });
      expect(result.success).toBe(true);
    });
  });

  describe("lifecycle status consistency", () => {
    it("should have all required lifecycle statuses", () => {
      expect(COMPANY_LIFECYCLE_STATUSES).toContain("draft");
      expect(COMPANY_LIFECYCLE_STATUSES).toContain("provisioning");
      expect(COMPANY_LIFECYCLE_STATUSES).toContain("active");
      expect(COMPANY_LIFECYCLE_STATUSES).toContain("failed");
      expect(COMPANY_LIFECYCLE_STATUSES).toContain("archived");
    });

    it("should have phase labels for all provisioning phases", () => {
      for (const phase of PROVISIONING_PHASES) {
        expect(PROVISIONING_PHASE_LABELS[phase]).toBeDefined();
        expect(PROVISIONING_PHASE_LABELS[phase].length).toBeGreaterThan(0);
      }
    });

    it("should have phase descriptions for all provisioning phases", () => {
      for (const phase of PROVISIONING_PHASES) {
        expect(PROVISIONING_PHASE_DESCRIPTIONS[phase]).toBeDefined();
        expect(PROVISIONING_PHASE_DESCRIPTIONS[phase].length).toBeGreaterThan(0);
      }
    });
  });

  describe("runtime attach phase truthfulness", () => {
    it("should label runtime_attach as attachment not connection", () => {
      expect(PROVISIONING_PHASE_LABELS.runtime_attach).toMatch(/attach/i);
    });

    it("should describe gateway as mandatory in runtime_attach description", () => {
      expect(PROVISIONING_PHASE_DESCRIPTIONS.runtime_attach).toMatch(/must be running/i);
    });
  });
});

describe("generation worker service", () => {
  it("should export a factory function", async () => {
    const { generationWorkerService } = await import("../services/generation-worker.js");
    const worker = generationWorkerService();
    expect(worker).toBeDefined();
    expect(typeof worker.generateContent).toBe("function");
  });

  it("should return success with empty files when no API key is set", async () => {
    const originalKey = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;

    try {
      const { generationWorkerService } = await import("../services/generation-worker.js");
      const worker = generationWorkerService();
      const result = await worker.generateContent({
        companyName: "Test Co",
        workspacePath: "/nonexistent",
      });
      expect(result.success).toBe(true);
      expect(result.filesGenerated).toEqual([]);
    } finally {
      if (originalKey) process.env.ANTHROPIC_API_KEY = originalKey;
    }
  });
});

describe("instance readiness", () => {
  it("anthropic key check returns ok:false when not set", () => {
    const saved = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    try {
      const svc = instanceReadinessService();
      const check = svc.checkAnthropicKey();
      expect(check.ok).toBe(false);
      expect(check.name).toBe("anthropic_key");
    } finally {
      if (saved !== undefined) process.env.ANTHROPIC_API_KEY = saved;
    }
  });

  it("baseline template check returns ok:true", () => {
    const svc = instanceReadinessService();
    const check = svc.checkBaselineTemplate();
    expect(check.ok).toBe(true);
    expect(check.name).toBe("baseline_template");
  });

  it("getFullReadiness returns valid structure", async () => {
    const svc = instanceReadinessService();
    const readiness = await svc.getFullReadiness();
    expect(readiness.checks).toBeInstanceOf(Array);
    expect(readiness.checks.length).toBeGreaterThanOrEqual(4);
    expect(["ready", "degraded", "not_ready"]).toContain(readiness.overallStatus);
    expect(readiness.timestamp).toBeDefined();
  });
});
