/**
 * Tests for the attach-existing-OpenClaw feature:
 * - workspaceDiscoveryService (filesystem scanning)
 * - checkGateway (gateway health checks)
 * - attachService (DB record creation for existing workspaces)
 * - Shared validators (Zod schemas for attach inputs)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// vi.mock calls — hoisted to top by vitest
// ---------------------------------------------------------------------------
vi.mock("node:fs", () => ({
  default: {
    existsSync: vi.fn(),
  },
  existsSync: vi.fn(),
}));

vi.mock("node:fs/promises", () => ({
  default: {
    stat: vi.fn(),
    readFile: vi.fn(),
  },
  stat: vi.fn(),
  readFile: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks are declared)
// ---------------------------------------------------------------------------
import fsp from "node:fs/promises";
import {
  discoverWorkspaceSchema,
  confirmAttachSchema,
} from "@paperclipai/shared";

// ==========================================================================
// 1. workspaceDiscoveryService
// ==========================================================================
describe("workspaceDiscoveryService", () => {
  let discoverWorkspace: Awaited<
    ReturnType<typeof import("../services/workspace-discovery.js")["workspaceDiscoveryService"]>
  >["discoverWorkspace"];

  beforeEach(async () => {
    vi.restoreAllMocks();
    const { workspaceDiscoveryService } = await import(
      "../services/workspace-discovery.js"
    );
    const svc = workspaceDiscoveryService();
    discoverWorkspace = svc.discoverWorkspace;
  });

  it("should return invalid when workspace path does not exist", async () => {
    vi.mocked(fsp.stat).mockRejectedValue(new Error("ENOENT: no such file or directory"));

    const result = await discoverWorkspace("/nonexistent/workspace");

    expect(result.overallStatus).toBe("invalid");
    expect(result.configFound).toBe(false);
    expect(result.agents).toHaveLength(0);
    expect(result.issues.length).toBeGreaterThan(0);
    expect(result.issues[0]).toMatch(/does not exist/i);
  });

  it("should return invalid when config file is missing", async () => {
    // Workspace dir exists
    vi.mocked(fsp.stat).mockImplementation(async (p: any) => {
      const ps = String(p);
      if (ps.endsWith("test-workspace") || ps === "/test-workspace") {
        return { isDirectory: () => true, isFile: () => false, size: 0 } as any;
      }
      throw new Error("ENOENT");
    });
    vi.mocked(fsp.readFile).mockRejectedValue(new Error("ENOENT: no such file"));

    const result = await discoverWorkspace("/test-workspace");

    expect(result.overallStatus).toBe("invalid");
    expect(result.configFound).toBe(false);
    expect(result.issues.some((i) => i.includes("Config file not found"))).toBe(true);
  });

  it("should return invalid when config file contains invalid JSON", async () => {
    vi.mocked(fsp.stat).mockImplementation(async (p: any) => {
      const ps = String(p);
      if (ps.endsWith("test-workspace") || ps === "/test-workspace") {
        return { isDirectory: () => true, isFile: () => false, size: 0 } as any;
      }
      throw new Error("ENOENT");
    });
    vi.mocked(fsp.readFile).mockResolvedValue("{ not valid json ,,," as any);

    const result = await discoverWorkspace("/test-workspace");

    expect(result.overallStatus).toBe("invalid");
    expect(result.configFound).toBe(true);
    expect(result.issues.some((i) => i.includes("Failed to parse"))).toBe(true);
  });

  it("should discover agents from a valid workspace", async () => {
    const validConfig = JSON.stringify({
      version: "1.0",
      workspace: "test-company",
      agents: [
        { role: "executive_assistant", name: "Executive Assistant", folder: "executive_assistant" },
        { role: "analyst", name: "Data Analyst", folder: "analyst" },
      ],
    });

    vi.mocked(fsp.stat).mockImplementation(async (p: any) => {
      const ps = String(p).replace(/\\/g, "/");
      // workspace dir
      if (ps === "/test-workspace") {
        return { isDirectory: () => true, isFile: () => false, size: 0 } as any;
      }
      // agent dirs
      if (ps.endsWith("/executive_assistant") || ps.endsWith("/analyst")) {
        return { isDirectory: () => true, isFile: () => false, size: 0 } as any;
      }
      // Files inside agent dirs — SOUL.md, AGENTS.md, IDENTITY.md, TOOLS.md, etc.
      if (ps.match(/\.(md|MD)$/)) {
        return { isDirectory: () => false, isFile: () => true, size: 512 } as any;
      }
      throw new Error("ENOENT");
    });
    vi.mocked(fsp.readFile).mockResolvedValue(validConfig as any);

    const result = await discoverWorkspace("/test-workspace");

    expect(result.configFound).toBe(true);
    expect(result.agents).toHaveLength(2);
    expect(result.agents[0].name).toBe("Executive Assistant");
    expect(result.agents[1].name).toBe("Data Analyst");
    expect(result.workspaceName).toBe("test-company");
    expect(result.workspaceVersion).toBe("1.0");
  });

  it("should mark agents as complete when all required files exist", async () => {
    const validConfig = JSON.stringify({
      version: "1.0",
      workspace: "test",
      agents: [{ role: "ops", name: "Ops Agent", folder: "ops" }],
    });

    vi.mocked(fsp.stat).mockImplementation(async (p: any) => {
      const ps = String(p).replace(/\\/g, "/");
      if (ps === "/workspace") {
        return { isDirectory: () => true, isFile: () => false, size: 0 } as any;
      }
      if (ps.endsWith("/ops")) {
        return { isDirectory: () => true, isFile: () => false, size: 0 } as any;
      }
      // All .md files exist
      if (ps.includes("/ops/")) {
        return { isDirectory: () => false, isFile: () => true, size: 256 } as any;
      }
      throw new Error("ENOENT");
    });
    vi.mocked(fsp.readFile).mockResolvedValue(validConfig as any);

    const result = await discoverWorkspace("/workspace");

    expect(result.agents).toHaveLength(1);
    expect(result.agents[0].status).toBe("complete");
    expect(result.overallStatus).toBe("ready");
  });

  it("should mark agents as partial when some required files are missing", async () => {
    const validConfig = JSON.stringify({
      version: "1.0",
      workspace: "test",
      agents: [{ role: "ops", name: "Ops Agent", folder: "ops" }],
    });

    const existingFiles = new Set(["SOUL.md"]);

    vi.mocked(fsp.stat).mockImplementation(async (p: any) => {
      const ps = String(p).replace(/\\/g, "/");
      if (ps === "/workspace") {
        return { isDirectory: () => true, isFile: () => false, size: 0 } as any;
      }
      if (ps.endsWith("/ops")) {
        return { isDirectory: () => true, isFile: () => false, size: 0 } as any;
      }
      // Only SOUL.md exists — missing AGENTS.md and IDENTITY.md
      const basename = ps.split("/").pop() ?? "";
      if (existingFiles.has(basename)) {
        return { isDirectory: () => false, isFile: () => true, size: 128 } as any;
      }
      throw new Error("ENOENT");
    });
    vi.mocked(fsp.readFile).mockResolvedValue(validConfig as any);

    const result = await discoverWorkspace("/workspace");

    expect(result.agents).toHaveLength(1);
    expect(result.agents[0].status).toBe("partial");
    expect(result.overallStatus).toBe("incomplete");
    expect(result.issues.some((i) => i.includes("missing required files"))).toBe(true);
  });

  it("should mark agents as missing when folder does not exist", async () => {
    const validConfig = JSON.stringify({
      version: "1.0",
      workspace: "test",
      agents: [{ role: "ops", name: "Ops Agent", folder: "ops" }],
    });

    vi.mocked(fsp.stat).mockImplementation(async (p: any) => {
      const ps = String(p).replace(/\\/g, "/");
      if (ps === "/workspace") {
        return { isDirectory: () => true, isFile: () => false, size: 0 } as any;
      }
      // Agent folder doesn't exist
      throw new Error("ENOENT");
    });
    vi.mocked(fsp.readFile).mockResolvedValue(validConfig as any);

    const result = await discoverWorkspace("/workspace");

    expect(result.agents).toHaveLength(1);
    expect(result.agents[0].status).toBe("missing");
    expect(result.overallStatus).toBe("incomplete");
  });

  it("should handle both config.agents[] and config.agents.list[] formats", async () => {
    // Test config.agents.list[] format
    const listConfig = JSON.stringify({
      version: "2.0",
      workspace: "list-format",
      agents: {
        list: [
          { role: "writer", name: "Writer Agent", folder: "writer" },
        ],
      },
    });

    vi.mocked(fsp.stat).mockImplementation(async (p: any) => {
      const ps = String(p).replace(/\\/g, "/");
      if (ps === "/workspace-list") {
        return { isDirectory: () => true, isFile: () => false, size: 0 } as any;
      }
      if (ps.endsWith("/writer")) {
        return { isDirectory: () => true, isFile: () => false, size: 0 } as any;
      }
      // All files exist in agent folder
      if (ps.includes("/writer/")) {
        return { isDirectory: () => false, isFile: () => true, size: 100 } as any;
      }
      throw new Error("ENOENT");
    });
    vi.mocked(fsp.readFile).mockResolvedValue(listConfig as any);

    const result = await discoverWorkspace("/workspace-list");

    expect(result.agents).toHaveLength(1);
    expect(result.agents[0].name).toBe("Writer Agent");
    expect(result.agents[0].role).toBe("writer");
    expect(result.agents[0].status).toBe("complete");
  });
});

// ==========================================================================
// 2. checkGateway
// ==========================================================================
describe("checkGateway", () => {
  let checkGateway: Awaited<
    ReturnType<typeof import("../services/workspace-discovery.js")["workspaceDiscoveryService"]>
  >["checkGateway"];
  let originalFetch: typeof globalThis.fetch;

  beforeEach(async () => {
    vi.restoreAllMocks();
    originalFetch = globalThis.fetch;
    const { workspaceDiscoveryService } = await import(
      "../services/workspace-discovery.js"
    );
    const svc = workspaceDiscoveryService();
    checkGateway = svc.checkGateway;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("should return healthy when gateway responds OK", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
    }) as unknown as typeof fetch;

    const result = await checkGateway("http://localhost:18789");

    expect(result.healthy).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("should return unhealthy when gateway returns error status", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      statusText: "Bad Gateway",
    }) as unknown as typeof fetch;

    const result = await checkGateway("http://localhost:18789");

    expect(result.healthy).toBe(false);
    expect(result.error).toMatch(/502/);
  });

  it("should return unhealthy when gateway is unreachable", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(
      new Error("fetch failed: ECONNREFUSED"),
    ) as unknown as typeof fetch;

    const result = await checkGateway("http://localhost:18789");

    expect(result.healthy).toBe(false);
    expect(result.error).toMatch(/unreachable/i);
  });

  it("should derive health URL correctly from gateway URL with /v1/responses suffix", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
    });
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    await checkGateway("http://localhost:18789/v1/responses");

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const calledUrl = mockFetch.mock.calls[0][0];
    expect(calledUrl).toBe("http://localhost:18789/health");
  });

  it("should derive health URL correctly from gateway URL without /v1/responses suffix", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
    });
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    await checkGateway("http://localhost:18789");

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const calledUrl = mockFetch.mock.calls[0][0];
    expect(calledUrl).toBe("http://localhost:18789/health");
  });
});

// ==========================================================================
// 3. attachService (with mocked DB)
// ==========================================================================

/**
 * Build a minimal mock Drizzle DB that supports the query patterns used by
 * attachService: select/from/where, insert/values/returning, insert/values/onConflictDoNothing.
 */
function createAttachMockDb() {
  const companyRows: Array<Record<string, unknown>> = [];
  const agentRows: Array<Record<string, unknown>> = [];
  const provisioningJobRows: Array<Record<string, unknown>> = [];
  const operations: Array<{ op: string; table: string; data?: Record<string, unknown> }> = [];

  function resolveTableName(tableRef: unknown): string {
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

  const db = {
    select() {
      return {
        from(tableRef: unknown) {
          const table = resolveTableName(tableRef);
          return {
            where(condition: unknown) {
              // For companies lookup — check if a matching row exists
              if (table === "companies") {
                // The condition uses eq(companies.name, companyName).
                // Since we cannot easily inspect the drizzle condition,
                // we return all company rows and let the service compare.
                // In practice the service only cares about [0] being truthy.
                const rows = [...companyRows];
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
              const obj: Record<string, unknown> = {
                then(onFulfilled: (v: unknown[]) => unknown, onRejected?: (e: unknown) => unknown) {
                  return Promise.resolve([]).then(onFulfilled, onRejected);
                },
                catch(onRejected: (e: unknown) => unknown) {
                  return Promise.resolve([]).catch(onRejected);
                },
                orderBy() { return obj; },
                limit() { return obj; },
              };
              return obj;
            },
          };
        },
      };
    },

    insert(tableRef: unknown) {
      const table = resolveTableName(tableRef);
      let pendingValues: Record<string, unknown> = {};
      /** Store the job/agent row when the insert is finalized. Guard against double-calls. */
      let stored = false;
      function storeRow() {
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
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          provisioningJobRows.push(row);
          operations.push({ op: "insert", table: "provisioning_jobs", data: { ...row } });
        }
        if (table === "agents") {
          agentRows.push({ ...pendingValues });
          operations.push({ op: "insert", table: "agents", data: { ...pendingValues } });
        }
      }

      const chain: Record<string, unknown> = {
        values(data: Record<string, unknown>) {
          pendingValues = data;
          return chain;
        },
        returning() {
          if (table === "companies") {
            // Simulate unique constraint on company name
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
            const row = {
              id: "company-new-" + Math.random().toString(36).slice(2, 8),
              name: pendingValues.name,
              description: pendingValues.description ?? null,
              status: pendingValues.status ?? "active",
              issuePrefix: pendingValues.issuePrefix ?? "CMP",
              issueCounter: 0,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
            companyRows.push(row);
            operations.push({ op: "insert", table: "companies", data: { ...row } });
            return Promise.resolve([row]);
          }
          if (table === "provisioning_jobs") {
            storeRow();
            return Promise.resolve([provisioningJobRows[provisioningJobRows.length - 1]]);
          }
          return Promise.resolve([]);
        },
        onConflictDoNothing() {
          storeRow();
          return Promise.resolve();
        },
        // When the chain is awaited directly (without .returning() or .onConflictDoNothing()),
        // finalize the insert.
        then(onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) {
          storeRow();
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
          operations.push({ op: "update", table, data: { ...pendingSet } });
          return {
            then(onFulfilled: (v: unknown) => unknown) {
              return Promise.resolve(undefined).then(onFulfilled);
            },
          };
        },
        then(onFulfilled: (v: unknown) => unknown) {
          return Promise.resolve(undefined).then(onFulfilled);
        },
      };
      return chain;
    },

    async transaction(fn: (tx: typeof db) => Promise<unknown>) {
      return fn(db);
    },
  };

  return {
    db,
    companyRows,
    agentRows,
    provisioningJobRows,
    operations,
    reset() {
      companyRows.length = 0;
      agentRows.length = 0;
      provisioningJobRows.length = 0;
      operations.length = 0;
    },
    /** Pre-seed a company to trigger the conflict check */
    seedCompany(overrides: Record<string, unknown> = {}) {
      companyRows.push({
        id: "existing-company",
        name: "Existing Corp",
        status: "active",
        ...overrides,
      });
    },
  };
}

describe("attachService", () => {
  let mockDb: ReturnType<typeof createAttachMockDb>;

  beforeEach(() => {
    mockDb = createAttachMockDb();
  });

  const BASE_INPUT = {
    companyName: "Signal Forge",
    companyDescription: "AI marketing company",
    gatewayUrl: "http://localhost:18789/v1/responses",
    workspacePath: "/home/user/openclaw-workspaces/signal-forge",
    agents: [
      { name: "Ops Manager", role: "ops_manager", folder: "ops_manager" },
      { name: "Content Writer", role: "content_writer", folder: "content_writer" },
    ],
  };

  it("should create company with active status", async () => {
    const { attachService: attachServiceFactory } = await import(
      "../services/attach.js"
    );
    const svc = attachServiceFactory(mockDb.db as any);

    const result = await svc.confirmAttach(BASE_INPUT);

    expect(result.companyName).toBe("Signal Forge");
    expect(result.provisioningMode).toBe("attach");
    // Company should be created with active status
    const companyInsert = mockDb.operations.find(
      (op) => op.op === "insert" && op.table === "companies",
    );
    expect(companyInsert).toBeDefined();
    expect(companyInsert!.data!.status).toBe("active");
  });

  it("should create agents with correct adapterConfig shape", async () => {
    const { attachService: attachServiceFactory } = await import(
      "../services/attach.js"
    );
    const svc = attachServiceFactory(mockDb.db as any);

    await svc.confirmAttach(BASE_INPUT);

    expect(mockDb.agentRows).toHaveLength(2);

    const firstAgent = mockDb.agentRows[0];
    expect(firstAgent.adapterType).toBe("openclaw");
    expect(firstAgent.name).toBe("Ops Manager");
    expect(firstAgent.role).toBe("ops_manager");

    const config = firstAgent.adapterConfig as Record<string, string>;
    expect(config.url).toBe(BASE_INPUT.gatewayUrl);
    expect(config.cwd).toMatch(/ops_manager$/);
    expect(config.workspacePath).toMatch(/ops_manager$/);
    expect(config.instructionsFilePath).toMatch(/ops_manager\/SOUL\.md$/);
    expect(config.agentsMdPath).toMatch(/ops_manager\/AGENTS\.md$/);
  });

  it("should create a completed provisioning job record", async () => {
    const { attachService: attachServiceFactory } = await import(
      "../services/attach.js"
    );
    const svc = attachServiceFactory(mockDb.db as any);

    await svc.confirmAttach(BASE_INPUT);

    expect(mockDb.provisioningJobRows).toHaveLength(1);
    const job = mockDb.provisioningJobRows[0];
    expect(job.status).toBe("completed");
    expect(job.currentPhase).toBe("activation");
    expect(job.phaseProgress).toBe(100);
    expect(job.gatewayUrl).toBe(BASE_INPUT.gatewayUrl);
    expect(job.startedAt).toBeDefined();
    expect(job.completedAt).toBeDefined();
    // Log entries should be present
    const log = job.log as Array<Record<string, string>>;
    expect(log.length).toBeGreaterThanOrEqual(3);
  });

  it("should throw conflict when company name already exists", async () => {
    mockDb.seedCompany({ name: "Signal Forge" });

    const { attachService: attachServiceFactory } = await import(
      "../services/attach.js"
    );
    const svc = attachServiceFactory(mockDb.db as any);

    await expect(svc.confirmAttach(BASE_INPUT)).rejects.toThrow(/already exists/i);
  });

  it("should normalize workspace paths to forward slashes", async () => {
    const { attachService: attachServiceFactory } = await import(
      "../services/attach.js"
    );
    const svc = attachServiceFactory(mockDb.db as any);

    const inputWithBackslashes = {
      ...BASE_INPUT,
      workspacePath: "C:\\Users\\dev\\openclaw-workspaces\\signal-forge",
    };

    const result = await svc.confirmAttach(inputWithBackslashes);

    expect(result.workspacePath).toBe("C:/Users/dev/openclaw-workspaces/signal-forge");
    // Agent workspace paths should also be normalized
    const agentConfig = mockDb.agentRows[0].adapterConfig as Record<string, string>;
    expect(agentConfig.cwd).not.toMatch(/\\/);
    expect(agentConfig.workspacePath).not.toMatch(/\\/);
  });

  it("should derive issue prefix from company name", async () => {
    const { attachService: attachServiceFactory } = await import(
      "../services/attach.js"
    );
    const svc = attachServiceFactory(mockDb.db as any);

    const result = await svc.confirmAttach(BASE_INPUT);

    // "Signal Forge" -> "SIG" (first 3 uppercase alpha chars)
    expect(result.issuePrefix).toBe("SIG");
  });
});

// ==========================================================================
// 4. Shared validators (Zod schemas)
// ==========================================================================
describe("shared attach validators", () => {
  describe("discoverWorkspaceSchema", () => {
    it("should accept valid input", () => {
      const result = discoverWorkspaceSchema.safeParse({
        gatewayUrl: "http://localhost:18789/v1/responses",
        workspacePath: "/home/user/workspace",
      });
      expect(result.success).toBe(true);
    });

    it("should reject invalid gateway URL", () => {
      const result = discoverWorkspaceSchema.safeParse({
        gatewayUrl: "not-a-url",
        workspacePath: "/home/user/workspace",
      });
      expect(result.success).toBe(false);
    });

    it("should reject empty workspace path", () => {
      const result = discoverWorkspaceSchema.safeParse({
        gatewayUrl: "http://localhost:18789",
        workspacePath: "",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("confirmAttachSchema", () => {
    it("should accept valid input with optional fields", () => {
      const result = confirmAttachSchema.safeParse({
        gatewayUrl: "http://localhost:18789/v1/responses",
        workspacePath: "/home/user/workspace",
        companyName: "Signal Forge",
        companyDescription: "An AI marketing company",
        selectedAgentFolders: ["ops", "writer"],
      });
      expect(result.success).toBe(true);
    });

    it("should accept valid input without optional fields", () => {
      const result = confirmAttachSchema.safeParse({
        gatewayUrl: "http://localhost:18789/v1/responses",
        workspacePath: "/home/user/workspace",
        companyName: "Signal Forge",
      });
      expect(result.success).toBe(true);
    });

    it("should reject missing company name", () => {
      const result = confirmAttachSchema.safeParse({
        gatewayUrl: "http://localhost:18789/v1/responses",
        workspacePath: "/home/user/workspace",
      });
      expect(result.success).toBe(false);
    });

    it("should reject empty company name", () => {
      const result = confirmAttachSchema.safeParse({
        gatewayUrl: "http://localhost:18789/v1/responses",
        workspacePath: "/home/user/workspace",
        companyName: "",
      });
      expect(result.success).toBe(false);
    });

    it("should reject invalid gateway URL in confirm schema", () => {
      const result = confirmAttachSchema.safeParse({
        gatewayUrl: "bad-url",
        workspacePath: "/workspace",
        companyName: "Test",
      });
      expect(result.success).toBe(false);
    });
  });
});
