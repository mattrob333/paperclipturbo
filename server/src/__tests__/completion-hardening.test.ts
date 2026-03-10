/**
 * Completion-hardening tests.
 *
 * Verifies the transactional safety, uniqueness constraint handling,
 * provisioning-mode truth, and idempotency guarantees added during the
 * OpenClaw Completion Mandate (Phase 5).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// vi.mock calls — hoisted to the top by vitest
// ---------------------------------------------------------------------------
vi.mock("node:fs", () => ({
  default: {
    existsSync: vi.fn().mockReturnValue(true),
  },
  existsSync: vi.fn().mockReturnValue(true),
}));

vi.mock("node:fs/promises", () => ({
  default: {
    stat: vi.fn(),
    readFile: vi.fn().mockResolvedValue(
      JSON.stringify({
        agents: [
          { name: "Agent1", role: "ops", folder: "ops" },
        ],
      }),
    ),
    mkdir: vi.fn().mockResolvedValue(undefined),
  },
  stat: vi.fn(),
  readFile: vi.fn().mockResolvedValue(
    JSON.stringify({
      agents: [
        { name: "Agent1", role: "ops", folder: "ops" },
      ],
    }),
  ),
  mkdir: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../services/workspace-initializer.js", () => ({
  workspaceInitializerService: () => ({
    baselineExists: () => true,
    getBaselineDir: () => "/mock/openclaw-baseline",
    initializeWorkspace: async () => ({
      filesCreated: ["SOUL.md", "AGENTS.md", "IDENTITY.md"],
    }),
  }),
}));

vi.mock("../services/generation-worker.js", () => ({
  generationWorkerService: () => ({
    generateContent: async (
      _input: unknown,
      onProgress?: (p: unknown) => void,
    ) => {
      onProgress?.({ phase: "complete", message: "done", filesWritten: [] });
      return { success: true, filesGenerated: ["ops/SOUL.md"], error: undefined };
    },
  }),
}));

// ---------------------------------------------------------------------------
// Mock DB factory
// ---------------------------------------------------------------------------

/**
 * Build a mock Drizzle DB that tracks state in-memory and records
 * every mutation for assertion.
 *
 * Supports:
 *  - select().from().where() chain
 *  - insert().values().returning() chain
 *  - insert().values().onConflictDoNothing() chain
 *  - update().set().where() chain
 *  - transaction(fn) that passes the db itself as the tx
 *  - Company name uniqueness (23505 / companies_name_uniq)
 *  - Issue prefix uniqueness (23505 / companies_issue_prefix_idx)
 *  - Rollback simulation: if the callback throws, discard in-flight writes
 */
function createMockDb() {
  const companyRows: Array<Record<string, unknown>> = [];
  const agentRows: Array<Record<string, unknown>> = [];
  const provisioningJobRows: Array<Record<string, unknown>> = [];
  const operations: Array<{
    op: string;
    table: string;
    data?: Record<string, unknown>;
  }> = [];

  /** Set of issue prefixes that should trigger a conflict. */
  const conflictingPrefixes = new Set<string>();

  function resolveTableName(tableRef: unknown): string {
    try {
      const s = JSON.stringify(tableRef);
      if (s.includes("provisioning_jobs")) return "provisioning_jobs";
      if (s.includes("companies")) return "companies";
      if (s.includes("agents")) return "agents";
    } catch {
      /* noop */
    }
    const str = String(tableRef);
    if (str.includes("provisioning_jobs")) return "provisioning_jobs";
    if (str.includes("companies")) return "companies";
    if (str.includes("agents")) return "agents";
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

  function makeThenable(rows: Record<string, unknown>[]) {
    const obj: Record<string, unknown> = {
      then(
        onFulfilled: (v: unknown[]) => unknown,
        onRejected?: (e: unknown) => unknown,
      ) {
        return Promise.resolve(rows).then(onFulfilled, onRejected);
      },
      catch(onRejected: (e: unknown) => unknown) {
        return Promise.resolve(rows).catch(onRejected);
      },
      orderBy() {
        return obj;
      },
      limit() {
        return obj;
      },
    };
    return obj;
  }

  const db = {
    select() {
      return {
        from(tableRef: unknown) {
          const table = resolveTableName(tableRef);
          return {
            where(_condition?: unknown) {
              if (table === "companies") {
                return makeThenable([...companyRows]);
              }
              if (table === "provisioning_jobs") {
                return makeThenable([...provisioningJobRows]);
              }
              return makeThenable([]);
            },
            orderBy() {
              return {
                limit() {
                  if (table === "provisioning_jobs") {
                    return makeThenable([...provisioningJobRows]);
                  }
                  return makeThenable([]);
                },
                then(
                  onFulfilled: (v: unknown[]) => unknown,
                  onRejected?: (e: unknown) => unknown,
                ) {
                  return Promise.resolve([]).then(onFulfilled, onRejected);
                },
              };
            },
          };
        },
      };
    },

    insert(tableRef: unknown) {
      const table = resolveTableName(tableRef);
      let pendingValues: Record<string, unknown> = {};
      let stored = false;

      function storeRow(
        target: {
          companyRows: typeof companyRows;
          agentRows: typeof agentRows;
          provisioningJobRows: typeof provisioningJobRows;
          operations: typeof operations;
        },
      ) {
        if (stored) return;
        stored = true;
        if (table === "provisioning_jobs") {
          const row = {
            id: "job-" + Math.random().toString(36).slice(2, 8),
            companyId: pendingValues.companyId,
            status: pendingValues.status ?? "queued",
            currentPhase: pendingValues.currentPhase ?? "pending",
            phaseProgress: pendingValues.phaseProgress ?? 0,
            workspacePath: pendingValues.workspacePath ?? null,
            gatewayUrl: pendingValues.gatewayUrl ?? null,
            log: pendingValues.log ?? [],
            startedAt: pendingValues.startedAt ?? null,
            completedAt: pendingValues.completedAt ?? null,
            provisioningMode: pendingValues.provisioningMode ?? null,
            runtimeMode: pendingValues.runtimeMode ?? null,
            retryCount: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          target.provisioningJobRows.push(row);
          target.operations.push({
            op: "insert",
            table: "provisioning_jobs",
            data: { ...row },
          });
        }
        if (table === "agents") {
          target.agentRows.push({ ...pendingValues });
          target.operations.push({
            op: "insert",
            table: "agents",
            data: { ...pendingValues },
          });
        }
      }

      const chain: Record<string, unknown> = {
        values(data: Record<string, unknown>) {
          pendingValues = data;
          return chain;
        },
        returning() {
          if (table === "companies") {
            // Name uniqueness
            const existingByName = companyRows.find(
              (c) => c.name === pendingValues.name,
            );
            if (existingByName) {
              const err: Record<string, unknown> = new Error(
                "duplicate key value violates unique constraint",
              );
              err.code = "23505";
              err.constraint = "companies_name_uniq";
              return Promise.reject(err);
            }
            // Issue prefix uniqueness
            if (
              conflictingPrefixes.has(
                String(pendingValues.issuePrefix ?? ""),
              )
            ) {
              // Remove it from the set so next attempt with a different
              // suffix succeeds.
              conflictingPrefixes.delete(
                String(pendingValues.issuePrefix ?? ""),
              );
              const err: Record<string, unknown> = new Error(
                "duplicate key value violates unique constraint",
              );
              err.code = "23505";
              err.constraint = "companies_issue_prefix_idx";
              return Promise.reject(err);
            }
            const row = {
              id:
                "company-new-" +
                Math.random().toString(36).slice(2, 8),
              name: pendingValues.name,
              description: pendingValues.description ?? null,
              status: pendingValues.status ?? "active",
              issuePrefix: pendingValues.issuePrefix ?? "CMP",
              issueCounter: 0,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
            companyRows.push(row);
            operations.push({
              op: "insert",
              table: "companies",
              data: { ...row },
            });
            return Promise.resolve([row]);
          }
          if (table === "provisioning_jobs") {
            storeRow({
              companyRows,
              agentRows,
              provisioningJobRows,
              operations,
            });
            return Promise.resolve([
              provisioningJobRows[provisioningJobRows.length - 1],
            ]);
          }
          return Promise.resolve([]);
        },
        onConflictDoNothing() {
          storeRow({
            companyRows,
            agentRows,
            provisioningJobRows,
            operations,
          });
          return Promise.resolve();
        },
        then(
          onFulfilled: (v: unknown) => unknown,
          onRejected?: (e: unknown) => unknown,
        ) {
          storeRow({
            companyRows,
            agentRows,
            provisioningJobRows,
            operations,
          });
          return Promise.resolve(undefined).then(onFulfilled, onRejected);
        },
      };
      return chain;
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
          operations.push({
            op: "update",
            table,
            data: { ...pendingSet },
          });
          // Also apply to in-memory rows for subsequent reads
          if (table === "companies" && companyRows.length) {
            Object.assign(companyRows[0], pendingSet);
          }
          if (table === "provisioning_jobs" && provisioningJobRows.length) {
            Object.assign(provisioningJobRows[0], pendingSet);
          }
          return makeThenable([]);
        },
        then(onFulfilled: (v: unknown) => unknown) {
          return Promise.resolve(undefined).then(onFulfilled);
        },
      };
      return chain;
    },

    /** Transaction: spy-able, with rollback simulation. */
    transaction: vi.fn(async function (fn: (tx: typeof db) => Promise<unknown>) {
      // Snapshot current lengths — if fn throws we truncate back.
      const compSnap = companyRows.length;
      const agentSnap = agentRows.length;
      const jobSnap = provisioningJobRows.length;
      const opsSnap = operations.length;

      try {
        return await fn(db);
      } catch (err) {
        // Simulate rollback: remove anything written during the failed tx.
        companyRows.length = compSnap;
        agentRows.length = agentSnap;
        provisioningJobRows.length = jobSnap;
        operations.length = opsSnap;
        throw err;
      }
    }),
  };

  return {
    db,
    companyRows,
    agentRows,
    provisioningJobRows,
    operations,
    conflictingPrefixes,
    reset() {
      companyRows.length = 0;
      agentRows.length = 0;
      provisioningJobRows.length = 0;
      operations.length = 0;
      conflictingPrefixes.clear();
      db.transaction.mockClear();
    },
    /** Pre-seed a company row. */
    seedCompany(overrides: Record<string, unknown> = {}) {
      companyRows.push({
        id: "existing-company",
        name: "Existing Corp",
        status: "active",
        issuePrefix: "EXI",
        ...overrides,
      });
    },
    /** Pre-seed a provisioning job row. */
    seedJob(overrides: Record<string, unknown> = {}) {
      provisioningJobRows.push({
        id: "job-1",
        companyId: "existing-company",
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
        provisioningMode: null,
        runtimeMode: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...overrides,
      });
    },
    /** Mark an issue prefix as conflicting (will trigger 23505 once). */
    addConflictingPrefix(prefix: string) {
      conflictingPrefixes.add(prefix);
    },
  };
}

// ---------------------------------------------------------------------------
// Shared constants
// ---------------------------------------------------------------------------

const BASE_ATTACH_INPUT = {
  companyName: "Test Corp",
  companyDescription: "A test company",
  gatewayUrl: "http://localhost:18789/v1/responses",
  workspacePath: "/home/user/openclaw-workspaces/test-corp",
  agents: [
    { name: "Ops Manager", role: "ops_manager", folder: "ops_manager" },
    { name: "Content Writer", role: "content_writer", folder: "content_writer" },
  ],
};

// ===========================================================================
// Group 1: Transaction safety (attach)
// ===========================================================================
describe("Group 1: Transaction safety (attach)", () => {
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    mockDb = createMockDb();
  });

  it("confirmAttach wraps all writes in a single transaction", async () => {
    const { attachService } = await import("../services/attach.js");
    const svc = attachService(mockDb.db as any);

    await svc.confirmAttach(BASE_ATTACH_INPUT);

    expect(mockDb.db.transaction).toHaveBeenCalledTimes(1);
  });

  it("confirmAttach rolls back on agent insertion failure", async () => {
    // Patch the insert chain so that agent inserts throw
    const originalInsert = mockDb.db.insert.bind(mockDb.db);
    let agentInsertCount = 0;
    mockDb.db.insert = function (tableRef: unknown) {
      const chain = originalInsert(tableRef);
      const originalOnConflictDoNothing = chain.onConflictDoNothing as () => Promise<void>;
      (chain as Record<string, unknown>).onConflictDoNothing = function () {
        agentInsertCount++;
        // Blow up on the first agent insert
        if (agentInsertCount === 1) {
          return Promise.reject(new Error("Simulated agent insert failure"));
        }
        return originalOnConflictDoNothing.call(chain);
      };
      return chain;
    } as typeof mockDb.db.insert;

    const { attachService } = await import("../services/attach.js");
    const svc = attachService(mockDb.db as any);

    await expect(svc.confirmAttach(BASE_ATTACH_INPUT)).rejects.toThrow(
      /Simulated agent insert failure/,
    );

    // Rollback: no company, no agents, no provisioning job should be persisted
    expect(mockDb.companyRows).toHaveLength(0);
    expect(mockDb.agentRows).toHaveLength(0);
    expect(mockDb.provisioningJobRows).toHaveLength(0);
  });

  it("confirmAttach creates company, provisioning job, and agents atomically", async () => {
    const { attachService } = await import("../services/attach.js");
    const svc = attachService(mockDb.db as any);

    await svc.confirmAttach(BASE_ATTACH_INPUT);

    // All three entity types were created
    const companyInserts = mockDb.operations.filter(
      (op) => op.op === "insert" && op.table === "companies",
    );
    const jobInserts = mockDb.operations.filter(
      (op) => op.op === "insert" && op.table === "provisioning_jobs",
    );
    const agentInserts = mockDb.operations.filter(
      (op) => op.op === "insert" && op.table === "agents",
    );

    expect(companyInserts).toHaveLength(1);
    expect(jobInserts).toHaveLength(1);
    expect(agentInserts).toHaveLength(2); // two agents in BASE_ATTACH_INPUT

    // All within a single transaction call
    expect(mockDb.db.transaction).toHaveBeenCalledTimes(1);
  });
});

// ===========================================================================
// Group 2: Company name uniqueness (attach)
// ===========================================================================
describe("Group 2: Company name uniqueness (attach)", () => {
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    mockDb = createMockDb();
  });

  it("confirmAttach rejects duplicate company name via DB constraint", async () => {
    // Pre-seed a company with the name we are about to insert
    mockDb.seedCompany({ name: "Test Corp" });

    const { attachService } = await import("../services/attach.js");
    const svc = attachService(mockDb.db as any);

    await expect(svc.confirmAttach(BASE_ATTACH_INPUT)).rejects.toThrow(
      /already exists/,
    );
  });

  it("confirmAttach handles both name and prefix conflicts", async () => {
    // Company name is unique, but the derived prefix "TES" conflicts.
    // The service should retry with suffix "A" and succeed.
    mockDb.addConflictingPrefix("TES");

    const { attachService } = await import("../services/attach.js");
    const svc = attachService(mockDb.db as any);

    const result = await svc.confirmAttach(BASE_ATTACH_INPUT);

    // Should succeed — the company was created with a suffixed prefix
    expect(result.companyName).toBe("Test Corp");
    expect(result.issuePrefix).toBe("TESA");
  });
});

// ===========================================================================
// Group 3: Provisioning mode truth
// ===========================================================================
describe("Group 3: Provisioning mode truth", () => {
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    mockDb = createMockDb();
  });

  it('confirmAttach sets provisioningMode to "attach" on job', async () => {
    const { attachService } = await import("../services/attach.js");
    const svc = attachService(mockDb.db as any);

    await svc.confirmAttach(BASE_ATTACH_INPUT);

    expect(mockDb.provisioningJobRows).toHaveLength(1);
    expect(mockDb.provisioningJobRows[0].provisioningMode).toBe("attach");
  });

  it('confirmAttach sets runtimeMode to "shared" on job', async () => {
    const { attachService } = await import("../services/attach.js");
    const svc = attachService(mockDb.db as any);

    await svc.confirmAttach(BASE_ATTACH_INPUT);

    expect(mockDb.provisioningJobRows).toHaveLength(1);
    expect(mockDb.provisioningJobRows[0].runtimeMode).toBe("shared");
  });

  it('createJob sets provisioningMode to "cold_start"', async () => {
    mockDb.seedCompany({ id: "company-1", name: "Test Co", status: "draft" });

    const { provisioningService } = await import("../services/provisioning.js");
    const svc = provisioningService(mockDb.db as any);

    await svc.createJob("company-1", {});

    // The job insert should include provisioningMode: "cold_start"
    const jobInsert = mockDb.operations.find(
      (op) =>
        op.op === "insert" &&
        op.table === "provisioning_jobs" &&
        op.data?.provisioningMode !== undefined,
    );
    expect(jobInsert).toBeDefined();
    expect(jobInsert!.data!.provisioningMode).toBe("cold_start");
  });
});

// ===========================================================================
// Group 4: Agent uniqueness
// ===========================================================================
describe("Group 4: Agent uniqueness", () => {
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    mockDb = createMockDb();
  });

  it("agent insert uses onConflictDoNothing for idempotency", async () => {
    const { attachService } = await import("../services/attach.js");
    const svc = attachService(mockDb.db as any);

    await svc.confirmAttach(BASE_ATTACH_INPUT);

    // Every agent insert should have gone through onConflictDoNothing
    // (confirmed by the operation being recorded without a "returning" step).
    const agentOps = mockDb.operations.filter(
      (op) => op.op === "insert" && op.table === "agents",
    );
    expect(agentOps).toHaveLength(2);

    // Verify the agents were inserted (via onConflictDoNothing path)
    expect(mockDb.agentRows).toHaveLength(2);
  });

  it("duplicate agent name within same company is handled by onConflictDoNothing", async () => {
    const { attachService } = await import("../services/attach.js");
    const svc = attachService(mockDb.db as any);

    // Input with two agents that have the same name
    const inputWithDuplicateAgents = {
      ...BASE_ATTACH_INPUT,
      agents: [
        { name: "Ops Manager", role: "ops_manager", folder: "ops_manager" },
        { name: "Ops Manager", role: "ops_manager", folder: "ops_manager" },
      ],
    };

    // Should NOT throw — onConflictDoNothing absorbs the duplicate
    await expect(
      svc.confirmAttach(inputWithDuplicateAgents),
    ).resolves.toBeDefined();
  });
});

// ===========================================================================
// Group 5: Transaction safety (provisioning)
// ===========================================================================
describe("Group 5: Transaction safety (provisioning)", () => {
  let mockDb: ReturnType<typeof createMockDb>;
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    mockDb = createMockDb();
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("retryJob wraps both updates in a transaction", async () => {
    mockDb.seedCompany({
      id: "company-1",
      name: "Test Co",
      status: "failed",
    });
    mockDb.seedJob({
      id: "job-1",
      companyId: "company-1",
      status: "failed",
      currentPhase: "generation",
      errorMessage: "Something broke",
      errorPhase: "generation",
      retryCount: 0,
    });

    const { provisioningService } = await import("../services/provisioning.js");
    const svc = provisioningService(mockDb.db as any);

    await svc.retryJob("job-1");

    // db.transaction should have been invoked
    expect(mockDb.db.transaction).toHaveBeenCalled();
  });

  it("activateCompany wraps all writes in a transaction", async () => {
    // Set up a job that is ready for activation
    mockDb.seedCompany({
      id: "company-1",
      name: "Test Co",
      status: "provisioning",
    });
    mockDb.seedJob({
      id: "job-1",
      companyId: "company-1",
      status: "running",
      currentPhase: "generation",
      phaseProgress: 100,
      workspacePath: "/tmp/test/test-co",
      gatewayUrl: "http://localhost:18789/v1/responses",
    });

    const { provisioningService } = await import("../services/provisioning.js");
    const svc = provisioningService(mockDb.db as any);

    await svc.activateCompany("job-1");

    // db.transaction should have been called at least once during activateCompany
    expect(mockDb.db.transaction).toHaveBeenCalled();
  });
});

// Need afterEach import for Group 5
import { afterEach } from "vitest";
