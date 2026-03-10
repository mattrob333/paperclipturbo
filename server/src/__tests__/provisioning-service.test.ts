/**
 * Deep integration tests for provisioningService with mocked DB.
 *
 * Tests in a separate file to avoid vi.mock hoisting conflicts with
 * the unit-level tests in provisioning.test.ts.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// vi.mock calls are hoisted to the top of the file by vitest.
// We mock the dynamic imports that executeJob uses internally.
vi.mock("../services/workspace-initializer.js", () => ({
  workspaceInitializerService: () => ({
    baselineExists: () => true,
    getBaselineDir: () => "/mock/openclaw-baseline",
    initializeWorkspace: async () => ({ filesCreated: ["SOUL.md", "AGENTS.md", "IDENTITY.md"] }),
  }),
}));

// Default: generation succeeds. Individual tests can override via mockGenerationResult.
let mockGenerationResult = { success: true, filesGenerated: ["ops/SOUL.md"], error: undefined as string | undefined };

vi.mock("../services/generation-worker.js", () => ({
  generationWorkerService: () => ({
    generateContent: async (_input: unknown, onProgress?: (p: unknown) => void) => {
      onProgress?.({ phase: "complete", message: "done", filesWritten: [] });
      return mockGenerationResult;
    },
  }),
}));

// ---------------------------------------------------------------------------
// Mock Drizzle DB
// ---------------------------------------------------------------------------

/**
 * Build a mock Drizzle DB that tracks state in-memory and records
 * every mutation for sequencing assertions.
 *
 * Drizzle query-builder patterns used by provisioningService:
 *   db.select().from(T).where(eq(...))                 -> Promise<row[]>
 *   db.select().from(T).where(eq(...)).orderBy().limit(n) -> Promise<row[]>
 *   db.update(T).set({...}).where(eq(...))              -> Promise<void>
 *   db.insert(T).values({...}).returning()              -> Promise<row[]>
 *   db.insert(T).values({...}).onConflictDoNothing()    -> Promise<void>
 */
function createMockDb() {
  const jobRows: Record<string, Record<string, unknown>> = {};
  const companyRows: Record<string, Record<string, unknown>> = {};
  const agentRows: Array<Record<string, unknown>> = [];
  const operations: Array<{ op: string; table: string; data?: Record<string, unknown> }> = [];

  function resolveTableName(tableRef: unknown): string {
    // Drizzle table refs carry a Symbol-based name, but we can match via
    // the table's declared SQL name which appears in Object.values.
    try {
      const s = JSON.stringify(tableRef);
      if (s.includes("provisioning_jobs")) return "provisioning_jobs";
      if (s.includes("companies")) return "companies";
      if (s.includes("agents")) return "agents";
    } catch { /* noop */ }
    const str = String(tableRef);
    if (str.includes("provisioning_jobs")) return "provisioning_jobs";
    if (str.includes("companies")) return "companies";
    if (str.includes("agents")) return "agents";

    // Drizzle pgTable objects have a [Table.Symbol.Name] property.
    // Try to read it from well-known Symbol keys.
    if (typeof tableRef === "object" && tableRef !== null) {
      for (const sym of Object.getOwnPropertySymbols(tableRef)) {
        const desc = sym.description ?? sym.toString();
        if (desc.includes("Name") || desc.includes("name")) {
          const val = (tableRef as Record<symbol, unknown>)[sym];
          if (typeof val === "string") {
            if (val === "provisioning_jobs") return "provisioning_jobs";
            if (val === "companies") return "companies";
            if (val === "agents") return "agents";
          }
        }
      }
    }
    return "unknown";
  }

  function firstRow(table: string): Record<string, unknown> | undefined {
    if (table === "provisioning_jobs") return Object.values(jobRows)[0];
    if (table === "companies") return Object.values(companyRows)[0];
    return undefined;
  }

  function applyUpdate(table: string, data: Record<string, unknown>) {
    const row = firstRow(table);
    if (row) {
      Object.assign(row, data);
      operations.push({ op: "update", table, data: { ...data } });
    }
  }

  /**
   * Return a thenable + chainable object. Drizzle query builders are both
   * Promises (via .then) and chainable (via .where/.set/etc).
   */
  function makeThenable(rows: Record<string, unknown>[]) {
    const obj: Record<string, unknown> = {
      then(onFulfilled: (v: unknown[]) => unknown, onRejected?: (e: unknown) => unknown) {
        return Promise.resolve(rows).then(onFulfilled, onRejected);
      },
      catch(onRejected: (e: unknown) => unknown) {
        return Promise.resolve(rows).catch(onRejected);
      },
      orderBy() { return obj; },
      limit() { return obj; },
    };
    return obj;
  }

  const db = {
    select() {
      return {
        from(tableRef: unknown) {
          const table = resolveTableName(tableRef);
          return {
            where() {
              const row = firstRow(table);
              return makeThenable(row ? [row] : []);
            },
            orderBy() {
              return {
                limit() {
                  const row = firstRow(table);
                  return makeThenable(row ? [row] : []);
                },
                then(onFulfilled: (v: unknown[]) => unknown, onRejected?: (e: unknown) => unknown) {
                  const row = firstRow(table);
                  return Promise.resolve(row ? [row] : []).then(onFulfilled, onRejected);
                },
              };
            },
          };
        },
      };
    },

    async transaction(fn: (tx: typeof db) => Promise<unknown>) {
      return fn(db);
    },

    update(tableRef: unknown) {
      const table = resolveTableName(tableRef);
      let pendingSet: Record<string, unknown> = {};
      const chain: Record<string, unknown> = {
        set(data: Record<string, unknown>) {
          pendingSet = data;
          return chain;
        },
        where() {
          applyUpdate(table, pendingSet);
          return makeThenable([]);
        },
        then(onFulfilled: (v: unknown) => unknown) {
          return Promise.resolve(undefined).then(onFulfilled);
        },
      };
      return chain;
    },

    insert(tableRef: unknown) {
      const table = resolveTableName(tableRef);
      let pendingValues: Record<string, unknown> = {};
      const chain: Record<string, unknown> = {
        values(data: Record<string, unknown>) {
          pendingValues = data;
          return chain;
        },
        returning() {
          if (table === "provisioning_jobs") {
            const row = {
              id: "job-new",
              companyId: pendingValues.companyId ?? "company-1",
              status: pendingValues.status ?? "queued",
              currentPhase: pendingValues.currentPhase ?? "pending",
              phaseProgress: 0,
              errorMessage: null,
              errorPhase: null,
              log: [],
              workspacePath: pendingValues.workspacePath ?? null,
              gatewayUrl: pendingValues.gatewayUrl ?? null,
              retryCount: 0,
              startedAt: null,
              completedAt: null,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
            jobRows[row.id] = row;
            operations.push({ op: "insert", table, data: { ...row } });
            return Promise.resolve([row]);
          }
          return Promise.resolve([]);
        },
        onConflictDoNothing() {
          if (table === "agents") {
            agentRows.push({ ...pendingValues });
            operations.push({ op: "insert", table: "agents", data: { ...pendingValues } });
          }
          return Promise.resolve();
        },
      };
      return chain;
    },
  };

  return {
    db,
    jobRows,
    companyRows,
    agentRows,
    operations,
    seedCompany(id: string, overrides: Record<string, unknown> = {}) {
      companyRows[id] = { id, name: "Test Company", status: "draft", ...overrides };
    },
    seedJob(id: string, overrides: Record<string, unknown> = {}) {
      jobRows[id] = {
        id,
        companyId: "company-1",
        status: "queued",
        currentPhase: "pending",
        phaseProgress: 0,
        errorMessage: null,
        errorPhase: null,
        log: [],
        workspacePath: null,
        gatewayUrl: null,
        retryCount: 0,
        startedAt: null,
        completedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...overrides,
      };
    },
    reset() {
      for (const k of Object.keys(jobRows)) delete jobRows[k];
      for (const k of Object.keys(companyRows)) delete companyRows[k];
      agentRows.length = 0;
      operations.length = 0;
    },
  };
}

// ---------------------------------------------------------------------------
// Shared state
// ---------------------------------------------------------------------------
let mockDb: ReturnType<typeof createMockDb>;
let originalFetch: typeof globalThis.fetch;

const EXEC_OPTS = {
  workspaceRoot: "/tmp/test",
  gatewayUrl: "http://localhost:18789/v1/responses",
  companyName: "Test Co",
  companySlug: "test-co",
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("provisioningService with mocked DB", () => {
  beforeEach(() => {
    mockDb = createMockDb();
    originalFetch = globalThis.fetch;
    // Default: generation succeeds
    mockGenerationResult = { success: true, filesGenerated: ["ops/SOUL.md"], error: undefined };
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  // Helper to mock fs and fetch for executeJob tests
  function setupFsAndFetch(opts: { gatewayOk?: boolean; gatewayReject?: boolean } = {}) {
    const fsModule = require("node:fs");
    vi.spyOn(fsModule, "existsSync").mockReturnValue(true);
    vi.spyOn(fsModule.promises, "readFile").mockResolvedValue(
      JSON.stringify({ agents: [{ name: "Agent1", role: "Ops", folder: "ops" }] }),
    );
    vi.spyOn(fsModule.promises, "mkdir").mockResolvedValue(undefined);

    if (opts.gatewayReject) {
      globalThis.fetch = vi.fn().mockRejectedValue(
        new Error("fetch failed: ECONNREFUSED"),
      ) as unknown as typeof fetch;
    } else {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: opts.gatewayOk ?? true,
        status: opts.gatewayOk === false ? 502 : 200,
      }) as unknown as typeof fetch;
    }
  }

  // =========================================================================
  // 1. createJob lifecycle
  // =========================================================================
  describe("createJob lifecycle", () => {
    it("should set company status to 'provisioning' when creating a job", async () => {
      mockDb.seedCompany("company-1", { status: "draft" });
      const { provisioningService } = await import("../services/provisioning.js");
      const svc = provisioningService(mockDb.db as any);

      await svc.createJob("company-1", {});

      expect(mockDb.companyRows["company-1"]?.status).toBe("provisioning");
    });

    it("should create a job with status 'queued' and phase 'pending'", async () => {
      mockDb.seedCompany("company-1");
      const { provisioningService } = await import("../services/provisioning.js");
      const svc = provisioningService(mockDb.db as any);

      const job = await svc.createJob("company-1", {});

      expect(job.status).toBe("queued");
      expect(job.currentPhase).toBe("pending");
    });
  });

  // =========================================================================
  // 2. Generation-before-activation (sequencing)
  // =========================================================================
  describe("executeJob phase ordering", () => {
    it("should call generation BEFORE activation on success", async () => {
      mockDb.seedCompany("company-1");
      mockDb.seedJob("job-1", { companyId: "company-1" });
      setupFsAndFetch();

      const { provisioningService } = await import("../services/provisioning.js");
      const svc = provisioningService(mockDb.db as any);

      await svc.executeJob("job-1", EXEC_OPTS);

      const phaseUpdates = mockDb.operations
        .filter((op) => op.op === "update" && op.table === "provisioning_jobs" && op.data?.currentPhase)
        .map((op) => op.data!.currentPhase);

      const genIdx = phaseUpdates.indexOf("generation");
      const actIdx = phaseUpdates.indexOf("activation");
      expect(genIdx).toBeGreaterThan(-1);
      expect(actIdx).toBeGreaterThan(-1);
      expect(genIdx).toBeLessThan(actIdx);
    });

    it("should NOT call activation when generation fails", async () => {
      mockDb.seedCompany("company-1");
      mockDb.seedJob("job-1", { companyId: "company-1" });
      setupFsAndFetch();
      mockGenerationResult = { success: false, filesGenerated: [], error: "Claude API down" };

      const { provisioningService } = await import("../services/provisioning.js");
      const svc = provisioningService(mockDb.db as any);

      await expect(svc.executeJob("job-1", EXEC_OPTS)).rejects.toThrow("Generation failed");

      const phaseUpdates = mockDb.operations
        .filter((op) => op.op === "update" && op.table === "provisioning_jobs" && op.data?.currentPhase)
        .map((op) => op.data!.currentPhase);

      expect(phaseUpdates).toContain("generation");
      expect(phaseUpdates).not.toContain("activation");
    });

    it("should set job status to 'failed' when generation fails", async () => {
      mockDb.seedCompany("company-1");
      mockDb.seedJob("job-1", { companyId: "company-1" });
      setupFsAndFetch();
      mockGenerationResult = { success: false, filesGenerated: [], error: "API key invalid" };

      const { provisioningService } = await import("../services/provisioning.js");
      const svc = provisioningService(mockDb.db as any);

      await expect(svc.executeJob("job-1", EXEC_OPTS)).rejects.toThrow();

      expect(mockDb.jobRows["job-1"]?.status).toBe("failed");
    });
  });

  // =========================================================================
  // 3. Company lifecycle transitions
  // =========================================================================
  describe("executeJob company lifecycle transitions", () => {
    it("should set company status to 'active' on successful completion", async () => {
      mockDb.seedCompany("company-1", { status: "provisioning" });
      mockDb.seedJob("job-1", { companyId: "company-1" });
      setupFsAndFetch();

      const { provisioningService } = await import("../services/provisioning.js");
      const svc = provisioningService(mockDb.db as any);

      await svc.executeJob("job-1", EXEC_OPTS);

      expect(mockDb.companyRows["company-1"]?.status).toBe("active");
    });

    it("should set company status to 'failed' on execution failure", async () => {
      mockDb.seedCompany("company-1", { status: "provisioning" });
      mockDb.seedJob("job-1", { companyId: "company-1" });
      setupFsAndFetch();
      mockGenerationResult = { success: false, filesGenerated: [], error: "fail" };

      const { provisioningService } = await import("../services/provisioning.js");
      const svc = provisioningService(mockDb.db as any);

      await expect(svc.executeJob("job-1", EXEC_OPTS)).rejects.toThrow();

      expect(mockDb.companyRows["company-1"]?.status).toBe("failed");
    });
  });

  // =========================================================================
  // 4. Gateway failure blocks provisioning
  // =========================================================================
  describe("gateway failure blocks provisioning", () => {
    it("should fail at runtime_attach when gateway returns HTTP error", async () => {
      mockDb.seedCompany("company-1", { status: "provisioning" });
      mockDb.seedJob("job-1", { companyId: "company-1" });
      setupFsAndFetch({ gatewayOk: false });

      const { provisioningService } = await import("../services/provisioning.js");
      const svc = provisioningService(mockDb.db as any);

      await expect(svc.executeJob("job-1", EXEC_OPTS)).rejects.toThrow(/gateway/i);

      expect(mockDb.jobRows["job-1"]?.status).toBe("failed");
      expect(mockDb.jobRows["job-1"]?.errorPhase).toBe("runtime_attach");
    });

    it("should fail at runtime_attach when gateway is unreachable", async () => {
      mockDb.seedCompany("company-1", { status: "provisioning" });
      mockDb.seedJob("job-1", { companyId: "company-1" });
      setupFsAndFetch({ gatewayReject: true });

      const { provisioningService } = await import("../services/provisioning.js");
      const svc = provisioningService(mockDb.db as any);

      await expect(svc.executeJob("job-1", EXEC_OPTS)).rejects.toThrow(/not reachable|gateway/i);

      expect(mockDb.jobRows["job-1"]?.status).toBe("failed");
    });
  });

  // =========================================================================
  // 5. Retry semantics
  // =========================================================================
  describe("retryJob semantics", () => {
    it("should reset currentPhase to 'pending' on retry", async () => {
      mockDb.seedCompany("company-1", { status: "failed" });
      mockDb.seedJob("job-1", {
        companyId: "company-1",
        status: "failed",
        currentPhase: "generation",
        errorMessage: "Generation failed",
        errorPhase: "generation",
        retryCount: 0,
      });

      const { provisioningService } = await import("../services/provisioning.js");
      const svc = provisioningService(mockDb.db as any);

      await svc.retryJob("job-1");

      expect(mockDb.jobRows["job-1"]?.currentPhase).toBe("pending");
    });

    it("should set company status back to 'provisioning' on retry", async () => {
      mockDb.seedCompany("company-1", { status: "failed" });
      mockDb.seedJob("job-1", {
        companyId: "company-1",
        status: "failed",
        currentPhase: "runtime_attach",
        retryCount: 1,
      });

      const { provisioningService } = await import("../services/provisioning.js");
      const svc = provisioningService(mockDb.db as any);

      await svc.retryJob("job-1");

      expect(mockDb.companyRows["company-1"]?.status).toBe("provisioning");
    });

    it("should increment retryCount on retry", async () => {
      mockDb.seedCompany("company-1", { status: "failed" });
      mockDb.seedJob("job-1", {
        companyId: "company-1",
        status: "failed",
        currentPhase: "generation",
        retryCount: 2,
      });

      const { provisioningService } = await import("../services/provisioning.js");
      const svc = provisioningService(mockDb.db as any);

      await svc.retryJob("job-1");

      const retryUpdates = mockDb.operations.filter(
        (op) => op.op === "update" && op.table === "provisioning_jobs" && op.data?.retryCount !== undefined,
      );
      expect(retryUpdates.length).toBeGreaterThan(0);
      expect(retryUpdates[0].data!.retryCount).toBe(3);
    });

    it("should set job status to 'queued' on retry", async () => {
      mockDb.seedCompany("company-1", { status: "failed" });
      mockDb.seedJob("job-1", {
        companyId: "company-1",
        status: "failed",
        retryCount: 0,
      });

      const { provisioningService } = await import("../services/provisioning.js");
      const svc = provisioningService(mockDb.db as any);

      await svc.retryJob("job-1");

      expect(mockDb.jobRows["job-1"]?.status).toBe("queued");
    });

    it("should clear error fields on retry", async () => {
      mockDb.seedCompany("company-1", { status: "failed" });
      mockDb.seedJob("job-1", {
        companyId: "company-1",
        status: "failed",
        errorMessage: "Something broke",
        errorPhase: "runtime_attach",
        retryCount: 0,
      });

      const { provisioningService } = await import("../services/provisioning.js");
      const svc = provisioningService(mockDb.db as any);

      await svc.retryJob("job-1");

      expect(mockDb.jobRows["job-1"]?.errorMessage).toBeNull();
      expect(mockDb.jobRows["job-1"]?.errorPhase).toBeNull();
    });

    it("should reject retry on non-failed jobs", async () => {
      mockDb.seedCompany("company-1", { status: "provisioning" });
      mockDb.seedJob("job-1", {
        companyId: "company-1",
        status: "running",
        retryCount: 0,
      });

      const { provisioningService } = await import("../services/provisioning.js");
      const svc = provisioningService(mockDb.db as any);

      await expect(svc.retryJob("job-1")).rejects.toThrow(/only retry failed/i);
    });
  });

  // =========================================================================
  // 6. Job completion semantics
  // =========================================================================
  describe("job completion semantics", () => {
    it("completed job should have status 'completed' and phase 'activation' at 100%", async () => {
      mockDb.seedCompany("company-1", { status: "provisioning" });
      mockDb.seedJob("job-1", { companyId: "company-1" });
      setupFsAndFetch();

      const { provisioningService } = await import("../services/provisioning.js");
      const svc = provisioningService(mockDb.db as any);

      await svc.executeJob("job-1", EXEC_OPTS);

      expect(mockDb.jobRows["job-1"]?.status).toBe("completed");
      expect(mockDb.jobRows["job-1"]?.currentPhase).toBe("activation");
      expect(mockDb.jobRows["job-1"]?.phaseProgress).toBe(100);
    });

    it("generation phase should reach 100% during successful execution", async () => {
      mockDb.seedCompany("company-1", { status: "provisioning" });
      mockDb.seedJob("job-1", { companyId: "company-1" });
      setupFsAndFetch();

      const { provisioningService } = await import("../services/provisioning.js");
      const svc = provisioningService(mockDb.db as any);

      await svc.executeJob("job-1", EXEC_OPTS);

      const gen100 = mockDb.operations.some(
        (op) =>
          op.op === "update" &&
          op.table === "provisioning_jobs" &&
          op.data?.currentPhase === "generation" &&
          op.data?.phaseProgress === 100,
      );
      expect(gen100).toBe(true);
    });
  });
});
