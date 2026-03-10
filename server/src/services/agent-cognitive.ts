import fsp from "node:fs/promises";
import path from "node:path";
import yaml from "js-yaml";
import type { Db } from "@paperclipai/db";
import type {
  AgentAdapterType,
  AgentCognitiveData,
  AgentCognitiveProfile,
  AgentRole,
  AuditDriftReport,
  CapabilityTag,
  CognitiveHealth,
  ConfidenceLevel,
  DelegationPolicy,
  MemorySource,
  ModelTier,
  OwnershipMode,
  RuntimeProfile,
  SkillChain,
  SkillChainStep,
  SkillChainStepType,
  ToolPermissionLevel,
  ToolPolicy,
} from "@paperclipai/shared";
import { agentService } from "./agents.js";
import { workspaceService } from "./workspace.js";

const AGENTORGCOMPILER_GENERATED_DIR =
  process.env.AGENTORGCOMPILER_GENERATED_DIR ??
  path.resolve(process.cwd(), "..", "AgentOrgCompiler", "generated");

const ISO_DATE_FALLBACK = new Date(0).toISOString();

const exporterVersion = "2025.03";

type AgentLike = {
  id: string;
  companyId: string;
  name: string;
  role: string;
  title: string | null;
  reportsTo: string | null;
  capabilities: string | null;
  adapterType: string;
  adapterConfig: Record<string, unknown>;
  runtimeConfig: Record<string, unknown>;
  metadata: Record<string, unknown> | null;
};

const asRecord = (value: unknown): Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
};

function mergeRuntimeProfile(base: RuntimeProfile, overrides: Partial<RuntimeProfile>): RuntimeProfile {
  return {
    ...base,
    ...overrides,
    adapter: overrides.adapter ?? base.adapter,
    modelName: overrides.modelName ?? base.modelName,
    modelTier: overrides.modelTier ?? base.modelTier,
    heartbeatMode: overrides.heartbeatMode ?? base.heartbeatMode,
    heartbeatInterval: overrides.heartbeatInterval ?? base.heartbeatInterval,
    cronJobs: overrides.cronJobs ?? base.cronJobs,
    sandboxMode: overrides.sandboxMode ?? base.sandboxMode,
    accessProfile: overrides.accessProfile ?? base.accessProfile,
    environmentStatus: overrides.environmentStatus ?? base.environmentStatus,
  };
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function asBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "yes", "y", "1"].includes(normalized)) return true;
    if (["false", "no", "n", "0"].includes(normalized)) return false;
  }
  return fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function detectModelTier(modelName: string): ModelTier {
  const lower = modelName.toLowerCase();
  if (lower.includes("opus") || lower.includes("sonnet")) return "frontier";
  if (lower.includes("haiku")) return "fast";
  if (lower.includes("mini")) return "mini";
  return "standard";
}

function normalizeAdapterType(value: string): AgentAdapterType {
  const allowed: AgentAdapterType[] = ["process", "http", "claude_local", "codex_local", "opencode_local", "cursor", "openclaw"];
  return allowed.includes(value as AgentAdapterType) ? (value as AgentAdapterType) : "openclaw";
}

function normalizeCapabilityTags(values: string[]): CapabilityTag[] {
  const allowed: CapabilityTag[] = [
    "Research",
    "Routing",
    "Strategy",
    "Execution",
    "Critique",
    "Writing",
    "Analysis",
    "Governance",
  ];
  const normalized = values
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => value.charAt(0).toUpperCase() + value.slice(1).toLowerCase());
  return normalized.filter((value): value is CapabilityTag => allowed.includes(value as CapabilityTag));
}

function inferCapabilityTags(agent: AgentLike, profile: AgentCognitiveProfile, toolPolicies: ToolPolicy[]): CapabilityTag[] {
  const roleText = `${agent.role} ${agent.title ?? ""} ${agent.capabilities ?? ""}`.toLowerCase();
  const tags = new Set<CapabilityTag>(profile.capabilityTags);
  if (roleText.includes("chief") || roleText.includes("lead") || roleText.includes("strategy")) tags.add("Strategy");
  if (roleText.includes("research")) tags.add("Research");
  if (roleText.includes("writer") || roleText.includes("content")) tags.add("Writing");
  if (roleText.includes("analytics") || roleText.includes("analysis")) tags.add("Analysis");
  if (roleText.includes("manager") || roleText.includes("coordinator")) tags.add("Routing");
  if (toolPolicies.length > 0) tags.add("Execution");
  return Array.from(tags);
}

function splitBullets(section: string | null): string[] {
  if (!section) return [];
  return section
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => line.replace(/^[-\s]*/, "").trim())
    .filter(Boolean);
}

function splitNumbered(section: string | null): string[] {
  if (!section) return [];
  return section
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^\d+[.)]\s+/.test(line))
    .map((line) => line.replace(/^\d+[.)]\s+/, "").trim())
    .filter(Boolean);
}

function splitList(section: string | null): string[] {
  const numbered = splitNumbered(section);
  return numbered.length > 0 ? numbered : splitBullets(section);
}

function extractSection(content: string, heading: string): string | null {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`##\\s+${escaped}\\s*\\n([\\s\\S]*?)(?=\\n##\\s+|$)`, "i");
  const match = content.match(regex);
  return match?.[1]?.trim() ?? null;
}

function extractSectionAny(content: string, headings: string[]): string | null {
  for (const heading of headings) {
    const section = extractSection(content, heading);
    if (section) return section;
  }
  return null;
}

function extractLineValue(content: string, label: string): string | null {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`^-\\s*\\*\\*${escaped}:\\*\\*\\s*(.+)$`, "im");
  return content.match(regex)?.[1]?.trim() ?? null;
}

function extractKvValue(content: string | null, label: string): string | null {
  if (!content) return null;
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`^-\\s*\\*\\*${escaped}:\\*\\*\\s*(.+)$`, "im"),
    new RegExp(`^-\\s*${escaped}:\\s*(.+)$`, "im"),
    new RegExp(`^${escaped}:\\s*(.+)$`, "im"),
  ];
  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match?.[1]?.trim()) return match[1].trim();
  }
  return null;
}

function extractSubsections(section: string | null): Array<{ title: string; content: string }> {
  if (!section) return [];
  const regex = /^###\s+(.+)$/gm;
  const matches = Array.from(section.matchAll(regex));
  if (matches.length === 0) return [];
  return matches.map((match, index) => {
    const title = match[1]?.trim() ?? `Section ${index + 1}`;
    const start = (match.index ?? 0) + match[0].length;
    const end = index + 1 < matches.length ? (matches[index + 1].index ?? section.length) : section.length;
    return {
      title,
      content: section.slice(start, end).trim(),
    };
  });
}

function normalizeConfidenceLevel(value: string | null | undefined, fallback: ConfidenceLevel = "medium"): ConfidenceLevel {
  const normalized = (value ?? "").trim().toLowerCase();
  if (normalized === "high") return "high";
  if (normalized === "medium") return "medium";
  if (normalized === "escalate") return "escalate";
  if (normalized === "needs_review" || normalized === "needs review") return "needs_review";
  return fallback;
}

function normalizeHealthStatus(value: string | null | undefined): AgentCognitiveProfile["healthStatus"] {
  const normalized = (value ?? "").trim().toLowerCase();
  if (["healthy", "warning", "drifted", "stale", "blocked", "degraded"].includes(normalized)) {
    return normalized as AgentCognitiveProfile["healthStatus"];
  }
  return "healthy";
}

function normalizePermissionLevel(value: string | null | undefined): ToolPermissionLevel {
  const normalized = (value ?? "").trim().toLowerCase();
  if (["full", "restricted", "read_only", "read only", "none"].includes(normalized)) {
    return normalized === "read only" ? "read_only" : (normalized as ToolPermissionLevel);
  }
  return "restricted";
}

function normalizeOwnershipMode(value: string | null | undefined): OwnershipMode {
  const normalized = (value ?? "").trim().toLowerCase();
  if (["owns", "delegates", "escalates", "collaborates"].includes(normalized)) {
    return normalized as OwnershipMode;
  }
  return "collaborates";
}

function parseSoul(agent: AgentLike, content: string): Partial<AgentCognitiveProfile> {
  const mission = extractSectionAny(content, ["Mission"]) ?? "";
  const identity = extractSectionAny(content, ["Identity", "Core Truths"]) ?? "";
  const communication = extractSectionAny(content, ["Communication Style"]) ?? "";
  const priorities = splitList(extractSectionAny(content, ["Priority Stack", "Priorities"]));
  const decisionRules = splitList(extractSectionAny(content, ["Decision Rules"]));
  const reasoningSequence = splitList(extractSectionAny(content, ["Reasoning Sequence", "Reasoning Approach"]));
  const boundaryRules = splitList(extractSectionAny(content, ["Boundary Rules", "Boundaries"]));
  const antiPatterns = splitList(extractSectionAny(content, ["Anti-Patterns", "Anti-Patterns (Avoid These)"]));
  const escalationTriggers = splitList(extractSectionAny(content, ["Escalation Triggers"]));
  const edgeCaseRules = splitList(extractSectionAny(content, ["Edge Case Rules"]));
  const capabilityTags = normalizeCapabilityTags(splitList(extractSectionAny(content, ["Capability Tags"])));
  const modelTierValue = extractKvValue(identity, "Model Tier");
  const confidencePolicy = normalizeConfidenceLevel(extractKvValue(identity, "Confidence Policy"), "medium");
  const healthStatus = normalizeHealthStatus(extractKvValue(identity, "Health Status"));
  return {
    mission,
    cognitiveRole: extractKvValue(identity, "Role") ?? agent.title ?? agent.role,
    specialization: communication || identity || agent.role,
    priorityStack: priorities,
    decisionRules,
    reasoningSequence,
    escalationTriggers,
    boundaryRules,
    antiPatterns,
    edgeCaseRules,
    capabilityTags,
    confidencePolicy,
    healthStatus,
    modelTier: detectModelTier(modelTierValue ?? agent.adapterType),
  };
}

function parseAgents(agentId: string, content: string): { escalationTriggers: string[]; skillChains: SkillChain[] } {
  const startupItems = splitBullets(extractSection(content, "Session Startup"));
  const escalationTriggers = splitBullets(extractSection(content, "Escalation Triggers"));
  const chainId = `${agentId}-startup`;
  const steps: SkillChainStep[] = startupItems.map((item, index) => ({
    id: `${chainId}-step-${index + 1}`,
    chainId,
    orderIndex: index,
    type: index === startupItems.length - 1 ? "review" : "action",
    title: item,
    description: item,
    toolRequired: null,
    delegateTarget: null,
    escalationTarget: null,
    successCondition: `Completed: ${item}`,
    failureCondition: `Unable to complete: ${item}`,
  }));
  const chains: SkillChain[] = steps.length
    ? [{
        id: chainId,
        agentId,
        name: "Session Startup Chain",
        description: "Default startup and execution sequence derived from AGENTS.md",
        isPrimary: true,
        startConditions: ["Agent wakeup", "New session"],
        steps,
        branches: {},
        completionCriteria: "Startup context loaded and execution flow established",
        fallbackBehavior: "Escalate to operator if startup context is incomplete",
        version: "1.0.0",
      }]
    : [];
  return { escalationTriggers, skillChains: chains };
}

function parseSkillChains(agentId: string, content: string): SkillChain[] {
  const section = extractSectionAny(content, ["Skill Chains"]);
  const blocks = extractSubsections(section);
  if (blocks.length === 0) return [];

  return blocks.map((block, chainIndex) => {
    const chainId = `${agentId}-skill-chain-${chainIndex + 1}`;
    const numberedSteps = splitNumbered(block.content);
    const startConditions = extractKvValue(block.content, "Start Conditions")
      ?.split(/[;,]\s*/)
      .map((item) => item.trim())
      .filter(Boolean) ?? [];
    const completionCriteria = extractKvValue(block.content, "Completion Criteria") ?? `Completed ${block.title}`;
    const fallbackBehavior = extractKvValue(block.content, "Fallback Behavior") ?? "Escalate to operator when uncertain";
    const steps: SkillChainStep[] = numberedSteps.map((step, stepIndex) => ({
      id: `${chainId}-step-${stepIndex + 1}`,
      chainId,
      orderIndex: stepIndex,
      type: stepIndex === numberedSteps.length - 1 ? "review" : "action",
      title: step,
      description: step,
      toolRequired: null,
      delegateTarget: null,
      escalationTarget: null,
      successCondition: `Completed: ${step}`,
      failureCondition: `Unable to complete: ${step}`,
    }));

    return {
      id: chainId,
      agentId,
      name: block.title,
      description: block.title,
      isPrimary: chainIndex === 0,
      startConditions,
      steps,
      branches: {},
      completionCriteria,
      fallbackBehavior,
      version: "1.0.0",
    };
  });
}

function parseTools(agentId: string, content: string): ToolPolicy[] {
  const lines = content.split(/\r?\n/).map((line) => line.trim());
  const bullets = lines.filter((line) => line.startsWith("- ")).map((line) => line.replace(/^-\s*/, ""));
  return bullets.map((bullet, index) => ({
    id: `${agentId}-tool-${index + 1}`,
    agentId,
    toolName: bullet.split(":")[0] ?? bullet,
    permissionLevel: "restricted" satisfies ToolPermissionLevel,
    usageConditions: [bullet],
    doNotUseConditions: [],
    fallbackBehavior: "Use documented manual workflow",
    preconditions: [],
    notes: bullet,
    lastUpdated: new Date().toISOString(),
    successRate: 0.9,
    failureRate: 0.1,
    usageCount: 0,
  }));
}

function parseToolPolicies(agentId: string, content: string): ToolPolicy[] {
  const section = extractSectionAny(content, ["Tool Policies"]);
  const blocks = extractSubsections(section);
  if (blocks.length === 0) return [];

  return blocks.map((block, index) => ({
    id: `${agentId}-tool-${index + 1}`,
    agentId,
    toolName: block.title,
    permissionLevel: normalizePermissionLevel(extractKvValue(block.content, "Permission")),
    usageConditions: splitList(extractKvValue(block.content, "Usage Conditions")),
    doNotUseConditions: splitList(extractKvValue(block.content, "Do Not Use")),
    fallbackBehavior: extractKvValue(block.content, "Fallback") ?? "Use documented manual workflow",
    preconditions: splitList(extractKvValue(block.content, "Preconditions")),
    notes: block.content,
    lastUpdated: ISO_DATE_FALLBACK,
    successRate: 0.9,
    failureRate: 0.1,
    usageCount: 0,
  }));
}

function parseMemory(agentId: string, modifiedAt: string): MemorySource[] {
  return [
    {
      id: `${agentId}-memory`,
      agentId,
      name: "Workspace Memory",
      type: "file" as const,
      path: "MEMORY.md",
      readPermission: true,
      writePermission: true,
      lastRefresh: modifiedAt,
      freshnessScore: 0.95,
      dependencies: ["SOUL.md", "AGENTS.md"],
    },
  ];
}

function parseMemorySources(agentId: string, content: string, modifiedAt: string): MemorySource[] {
  const section = extractSectionAny(content, ["Memory Sources"]);
  const blocks = extractSubsections(section);
  if (blocks.length === 0) return [];

  return blocks.map((block, index) => ({
    id: `${agentId}-memory-${index + 1}`,
    agentId,
    name: block.title,
    type: (() => {
      const value = (extractKvValue(block.content, "Type") ?? "file").trim().toLowerCase();
      return (["file", "database", "api", "shared_context"].includes(value) ? value : "file") as MemorySource["type"];
    })(),
    path: extractKvValue(block.content, "Path") ?? block.title,
    readPermission: asBoolean(extractKvValue(block.content, "Read"), true),
    writePermission: asBoolean(extractKvValue(block.content, "Write"), false),
    lastRefresh: modifiedAt,
    freshnessScore: asNumber(extractKvValue(block.content, "Freshness"), 0.95),
    dependencies: splitList(extractKvValue(block.content, "Dependencies")),
  }));
}

function parseHeartbeat(agentId: string, content: string): Pick<RuntimeProfile, "heartbeatMode" | "heartbeatInterval" | "cronJobs"> {
  const modeMatch = content.match(/Heartbeat mode:\s*(.+)$/im);
  const mode = modeMatch?.[1]?.trim() ?? "on-demand";
  const cronJobs = splitBullets(content);
  return {
    heartbeatMode: mode,
    heartbeatInterval: mode === "on-demand" ? 0 : 300,
    cronJobs: cronJobs.filter((line) => !line.toLowerCase().includes("mode:")),
  };
}

function parseIdentity(content: string): { specialization: string } {
  return {
    specialization: extractLineValue(content, "Vibe") ?? "workspace-defined agent",
  };
}

function parseRuntimeProfile(agent: AgentLike, content: string): Partial<RuntimeProfile> {
  const section = extractSectionAny(content, ["Runtime Profile"]);
  if (!section) return {};

  return {
    adapter: normalizeAdapterType(extractKvValue(section, "Adapter") ?? agent.adapterType),
    modelName: extractKvValue(section, "Model Name") ?? asString(asRecord(agent.runtimeConfig).modelName),
    heartbeatMode: extractKvValue(section, "Heartbeat Mode") ?? "on-demand",
    heartbeatInterval: asNumber(extractKvValue(section, "Heartbeat Interval"), 0),
    cronJobs: splitList(extractKvValue(section, "Cron Jobs")),
    sandboxMode: asBoolean(extractKvValue(section, "Sandbox Mode"), false),
    accessProfile: extractKvValue(section, "Access Profile") ?? "workspace",
    environmentStatus: extractKvValue(section, "Environment Status") ?? "active",
  };
}

function parseDelegationPolicies(agentId: string, content: string): DelegationPolicy[] {
  const section = extractSectionAny(content, ["Delegation Policies"]);
  const blocks = extractSubsections(section);
  if (blocks.length === 0) return [];

  return blocks.map((block, index) => ({
    id: `${agentId}-delegation-${index + 1}`,
    agentId,
    taskClass: block.title,
    ownershipMode: normalizeOwnershipMode(extractKvValue(block.content, "Ownership Mode")),
    delegateTo: extractKvValue(block.content, "Delegate To"),
    escalateTo: extractKvValue(block.content, "Escalate To"),
    approvalRequired: asBoolean(extractKvValue(block.content, "Approval Required"), false),
    confidenceThreshold: normalizeConfidenceLevel(extractKvValue(block.content, "Confidence Threshold"), "medium"),
    notes: extractKvValue(block.content, "Notes") ?? block.content,
  }));
}

function buildDelegationPolicies(agent: AgentLike, allAgents: AgentLike[]): DelegationPolicy[] {
  const reportsTo = agent.reportsTo ? allAgents.find((candidate) => candidate.id === agent.reportsTo) : null;
  const directReports = allAgents.filter((candidate) => candidate.reportsTo === agent.id);
  const policies: DelegationPolicy[] = [];
  if (reportsTo) {
    policies.push({
      id: `${agent.id}-delegation-escalate`,
      agentId: agent.id,
      taskClass: "manager_escalation",
      ownershipMode: "escalates" satisfies OwnershipMode,
      delegateTo: null,
      escalateTo: reportsTo.id,
      approvalRequired: false,
      confidenceThreshold: "medium" satisfies ConfidenceLevel,
      notes: `Escalate unresolved work to ${reportsTo.name}`,
    });
  }
  for (const report of directReports) {
    policies.push({
      id: `${agent.id}-delegation-${report.id}`,
      agentId: agent.id,
      taskClass: report.role.replace(/\s+/g, "_").toLowerCase(),
      ownershipMode: "delegates" satisfies OwnershipMode,
      delegateTo: report.id,
      escalateTo: null,
      approvalRequired: false,
      confidenceThreshold: "high" satisfies ConfidenceLevel,
      notes: `Delegate ${report.title ?? report.role} work to ${report.name}`,
    });
  }
  return policies;
}

function buildRuntimeProfile(agent: AgentLike, heartbeat: Pick<RuntimeProfile, "heartbeatMode" | "heartbeatInterval" | "cronJobs">): RuntimeProfile {
  const adapterConfig = asRecord(agent.adapterConfig);
  const runtimeConfig = asRecord(agent.runtimeConfig);
  const modelName =
    asString(runtimeConfig.modelName) ||
    asString(asRecord(adapterConfig.model).primary) ||
    `${agent.adapterType}`;
  const sandboxMode = Boolean(runtimeConfig.sandboxMode ?? adapterConfig.sandboxMode ?? false);
  return {
    id: `${agent.id}-runtime`,
    agentId: agent.id,
    adapter: normalizeAdapterType(agent.adapterType),
    modelName,
    modelTier: detectModelTier(modelName),
    heartbeatMode: heartbeat.heartbeatMode,
    heartbeatInterval: heartbeat.heartbeatInterval,
    cronJobs: heartbeat.cronJobs,
    sandboxMode,
    accessProfile: asString(runtimeConfig.accessProfile, "workspace"),
    environmentStatus: "active",
    exporterVersion,
  };
}

function buildAudit(agentId: string): AuditDriftReport {
  const now = new Date().toISOString();
  return {
    id: `${agentId}-audit`,
    agentId,
    blueprintVersion: exporterVersion,
    liveVersion: exporterVersion,
    driftScore: 0,
    missingFields: [],
    mismatchedFields: [],
    staleFields: [],
    lastAuditedAt: now,
    stewardRecommendations: [],
  };
}

function buildHealth(agentId: string, toolCount: number, delegationCount: number): CognitiveHealth {
  return {
    agentId,
    alignmentScore: 0.95,
    driftScore: 0.05,
    completenessScore: toolCount > 0 ? 0.9 : 0.7,
    toolPolicyCoverage: toolCount > 0 ? 0.9 : 0.4,
    delegationCoverage: delegationCount > 0 ? 0.9 : 0.5,
    lastAssessed: new Date().toISOString(),
  };
}

type InstanceManifest = {
  company_name?: string;
  openclaw?: {
    workspace_path?: string;
  };
  paperclip?: {
    companyId?: string;
    company_id?: string;
    agentIdMap?: Record<string, string>;
    agent_id_map?: Record<string, string>;
  };
};

function normalizeSlug(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

async function resolveExistingDirectory(candidates: string[]): Promise<string | null> {
  for (const candidate of candidates) {
    try {
      const stat = await fsp.stat(candidate);
      if (stat.isDirectory()) return candidate;
    } catch {
      // Try next candidate.
    }
  }
  return null;
}

async function readInstanceManifest(manifestPath: string): Promise<InstanceManifest | null> {
  try {
    const raw = await fsp.readFile(manifestPath, "utf-8");
    const parsed = yaml.load(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed as InstanceManifest;
  } catch {
    return null;
  }
}

async function findManifestWorkspaceRoot(agent: AgentLike, adapterConfig: Record<string, unknown>): Promise<string | null> {
  const payloadTemplate = asRecord(adapterConfig.payloadTemplate);
  const generatedRoot = AGENTORGCOMPILER_GENERATED_DIR;
  let entries: string[];
  try {
    entries = await fsp.readdir(generatedRoot);
  } catch {
    return null;
  }

  for (const entry of entries) {
    const manifestPath = path.join(generatedRoot, entry, "instance.manifest.yaml");
    const manifest = await readInstanceManifest(manifestPath);
    if (!manifest) continue;

    const paperclip = manifest.paperclip ?? {};
    const manifestCompanyId = asString(paperclip.companyId) ?? asString(paperclip.company_id);
    if (manifestCompanyId !== agent.companyId) continue;

    const agentIdMap = asRecord(paperclip.agentIdMap) ?? asRecord(paperclip.agent_id_map) ?? {};
    const mappedRoleKey = Object.entries(agentIdMap).find(([_roleKey, mappedAgentId]) => mappedAgentId === agent.id)?.[0] ?? null;
    const rawRoleId =
      mappedRoleKey?.replace(/-/g, "_") ??
      asString(payloadTemplate.agentId) ??
      asString(asRecord(agent.metadata).originalRoleId) ??
      null;
    if (!rawRoleId) continue;

    const roleCandidates = Array.from(
      new Set([
        rawRoleId,
        normalizeSlug(rawRoleId),
        rawRoleId.replace(/-/g, "_"),
        rawRoleId.replace(/_/g, "-"),
      ].filter(Boolean)),
    );

    const workspacePath = asString(manifest.openclaw?.workspace_path);
    if (workspacePath) {
      const directMatch = await resolveExistingDirectory(
        roleCandidates.map((roleKey) => path.resolve(workspacePath, roleKey)),
      );
      if (directMatch) return directMatch;
    }

    const generatedMatch = await resolveExistingDirectory(
      roleCandidates.map((roleKey) => path.resolve(generatedRoot, entry, "openclaw", roleKey)),
    );
    if (generatedMatch) return generatedMatch;
  }

  return null;
}

async function readOptionalFile(root: string, relativePath: string): Promise<{ content: string; modifiedAt: string } | null> {
  try {
    const absolutePath = path.join(root, relativePath);
    const stat = await fsp.stat(absolutePath);
    const content = await fsp.readFile(absolutePath, "utf-8");
    return { content, modifiedAt: stat.mtime.toISOString() };
  } catch {
    return null;
  }
}

export function agentCognitiveService(db: Db) {
  const agentsSvc = agentService(db);
  const workspace = workspaceService();

  async function getByAgent(agentId: string): Promise<AgentCognitiveData | null> {
    const agent = await agentsSvc.getById(agentId);
    if (!agent) return null;

    const allAgents = (await agentsSvc.list(agent.companyId)) as AgentLike[];
    const adapterConfig = asRecord(agent.adapterConfig);
    const workspaceRoot =
      (await workspace.resolveWorkspaceRoot(adapterConfig)) ??
      (await findManifestWorkspaceRoot(agent, adapterConfig));
    if (!workspaceRoot) return null;

    const soul = await readOptionalFile(workspaceRoot, "SOUL.md");
    const agentsFile = await readOptionalFile(workspaceRoot, "AGENTS.md");
    const identity = await readOptionalFile(workspaceRoot, "IDENTITY.md");
    const tools = await readOptionalFile(workspaceRoot, "TOOLS.md");
    const memory = await readOptionalFile(workspaceRoot, "MEMORY.md");
    const heartbeat = await readOptionalFile(workspaceRoot, "HEARTBEAT.md");

    const soulProfile = soul ? parseSoul(agent, soul.content) : {};
    const identityInfo = identity ? parseIdentity(identity.content) : { specialization: agent.role };
    const parsedAgents = agentsFile ? parseAgents(agent.id, agentsFile.content) : { escalationTriggers: [], skillChains: [] };
    const soulSkillChains = soul ? parseSkillChains(agent.id, soul.content) : [];
    const toolPolicies = soul ? parseToolPolicies(agent.id, soul.content) : [];
    const fallbackToolPolicies = toolPolicies.length === 0 && tools ? parseTools(agent.id, tools.content) : [];
    const delegationPolicies = soul ? parseDelegationPolicies(agent.id, soul.content) : [];
    const fallbackDelegationPolicies = delegationPolicies.length === 0 ? buildDelegationPolicies(agent, allAgents) : [];
    const runtimeBits = heartbeat ? parseHeartbeat(agent.id, heartbeat.content) : { heartbeatMode: "on-demand", heartbeatInterval: 0, cronJobs: [] };
    const memorySources = soul ? parseMemorySources(agent.id, soul.content, soul.modifiedAt) : [];
    const fallbackMemorySources = memory && memorySources.length === 0 ? parseMemory(agent.id, memory.modifiedAt) : [];

    const preliminaryProfile: AgentCognitiveProfile = {
      mission: soulProfile.mission ?? agent.capabilities ?? `${agent.name} operates within the OpenClaw workspace`,
      cognitiveRole: soulProfile.cognitiveRole ?? agent.title ?? agent.role,
      specialization: identityInfo.specialization || soulProfile.specialization || agent.role,
      priorityStack: soulProfile.priorityStack ?? [],
      decisionRules: soulProfile.decisionRules ?? [],
      reasoningSequence: soulProfile.reasoningSequence ?? [],
      escalationTriggers: soulProfile.escalationTriggers ?? parsedAgents.escalationTriggers,
      antiPatterns: soulProfile.antiPatterns ?? [],
      boundaryRules: soulProfile.boundaryRules ?? [],
      confidencePolicy: soulProfile.confidencePolicy ?? "medium",
      edgeCaseRules: soulProfile.edgeCaseRules ?? [],
      capabilityTags: soulProfile.capabilityTags ?? normalizeCapabilityTags(asStringArray(asRecord(agent.metadata).capabilityTags)),
      healthStatus: soulProfile.healthStatus ?? "healthy",
      driftStatus: 0,
      blueprintVersion: exporterVersion,
      lastSyncAt: new Date().toISOString(),
      modelTier: soulProfile.modelTier ?? detectModelTier(asString(asRecord(agent.runtimeConfig).modelName) || asString(asRecord(adapterConfig.model).primary) || agent.adapterType),
      toolCount: (toolPolicies.length > 0 ? toolPolicies : fallbackToolPolicies).length,
    };

    const resolvedToolPolicies = toolPolicies.length > 0 ? toolPolicies : fallbackToolPolicies;
    preliminaryProfile.capabilityTags = inferCapabilityTags(agent, preliminaryProfile, resolvedToolPolicies);

    const runtimeProfile = mergeRuntimeProfile(
      buildRuntimeProfile(agent, runtimeBits),
      soul ? parseRuntimeProfile(agent, soul.content) : {},
    );
    preliminaryProfile.modelTier = runtimeProfile.modelTier;

    const allowedRoles: AgentRole[] = ["ceo", "cto", "cmo", "cfo", "engineer", "designer", "pm", "qa", "devops", "researcher", "general"];
    const agentRole = allowedRoles.includes(agent.role as AgentRole) ? (agent.role as AgentRole) : "general";

    return {
      agentId: agent.id,
      agentName: agent.name,
      agentRole,
      profile: preliminaryProfile,
      skillChains: soulSkillChains.length > 0 ? soulSkillChains : parsedAgents.skillChains,
      toolPolicies: resolvedToolPolicies,
      delegationPolicies: delegationPolicies.length > 0 ? delegationPolicies : fallbackDelegationPolicies,
      runtimeProfile,
      auditDriftReport: buildAudit(agent.id),
      memorySources: memorySources.length > 0 ? memorySources : fallbackMemorySources,
      cognitiveHealth: buildHealth(
        agent.id,
        resolvedToolPolicies.length,
        (delegationPolicies.length > 0 ? delegationPolicies : fallbackDelegationPolicies).length,
      ),
    };
  }

  return {
    getByAgent,
  };
}
