import type { AgentAdapterType, AgentRole } from "../constants.js";

// ---------------------------------------------------------------------------
// Scalar union types
// ---------------------------------------------------------------------------

export const CAPABILITY_TAGS = [
  "Research",
  "Routing",
  "Strategy",
  "Execution",
  "Critique",
  "Writing",
  "Analysis",
  "Governance",
] as const;
export type CapabilityTag = (typeof CAPABILITY_TAGS)[number];

export const HEALTH_STATUSES = [
  "healthy",
  "warning",
  "drifted",
  "stale",
  "blocked",
  "degraded",
] as const;
export type HealthStatus = (typeof HEALTH_STATUSES)[number];

export const CONFIDENCE_LEVELS = [
  "high",
  "medium",
  "escalate",
  "needs_review",
] as const;
export type ConfidenceLevel = (typeof CONFIDENCE_LEVELS)[number];

export const SKILL_CHAIN_STEP_TYPES = [
  "action",
  "tool_call",
  "delegation",
  "review",
  "escalation",
  "decision",
] as const;
export type SkillChainStepType = (typeof SKILL_CHAIN_STEP_TYPES)[number];

export const TOOL_PERMISSION_LEVELS = [
  "full",
  "restricted",
  "read_only",
  "none",
] as const;
export type ToolPermissionLevel = (typeof TOOL_PERMISSION_LEVELS)[number];

export const OWNERSHIP_MODES = [
  "owns",
  "delegates",
  "escalates",
  "collaborates",
] as const;
export type OwnershipMode = (typeof OWNERSHIP_MODES)[number];

export const MODEL_TIERS = [
  "frontier",
  "standard",
  "fast",
  "mini",
] as const;
export type ModelTier = (typeof MODEL_TIERS)[number];

export const MEMORY_SOURCE_TYPES = [
  "file",
  "database",
  "api",
  "shared_context",
] as const;
export type MemorySourceType = (typeof MEMORY_SOURCE_TYPES)[number];

// ---------------------------------------------------------------------------
// Extended Agent cognitive fields
// ---------------------------------------------------------------------------

export interface AgentCognitiveProfile {
  mission: string;
  cognitiveRole: string;
  specialization: string;
  priorityStack: string[];
  decisionRules: string[];
  reasoningSequence: string[];
  escalationTriggers: string[];
  antiPatterns: string[];
  boundaryRules: string[];
  confidencePolicy: ConfidenceLevel;
  edgeCaseRules: string[];
  capabilityTags: CapabilityTag[];
  healthStatus: HealthStatus;
  driftStatus: number;
  blueprintVersion: string;
  lastSyncAt: string;
  modelTier: ModelTier;
  toolCount: number;
}

// ---------------------------------------------------------------------------
// Skill chains
// ---------------------------------------------------------------------------

export interface SkillChainStep {
  id: string;
  chainId: string;
  orderIndex: number;
  type: SkillChainStepType;
  title: string;
  description: string;
  toolRequired: string | null;
  delegateTarget: string | null;
  escalationTarget: string | null;
  successCondition: string;
  failureCondition: string;
}

export interface SkillChain {
  id: string;
  agentId: string;
  name: string;
  description: string;
  isPrimary: boolean;
  startConditions: string[];
  steps: SkillChainStep[];
  branches: Record<string, string>;
  completionCriteria: string;
  fallbackBehavior: string;
  version: string;
}

// ---------------------------------------------------------------------------
// Tool policy
// ---------------------------------------------------------------------------

export interface ToolPolicy {
  id: string;
  agentId: string;
  toolName: string;
  permissionLevel: ToolPermissionLevel;
  usageConditions: string[];
  doNotUseConditions: string[];
  fallbackBehavior: string;
  preconditions: string[];
  notes: string;
  lastUpdated: string;
  successRate: number;
  failureRate: number;
  usageCount: number;
}

// ---------------------------------------------------------------------------
// Delegation policy
// ---------------------------------------------------------------------------

export interface DelegationPolicy {
  id: string;
  agentId: string;
  taskClass: string;
  ownershipMode: OwnershipMode;
  delegateTo: string | null;
  escalateTo: string | null;
  approvalRequired: boolean;
  confidenceThreshold: ConfidenceLevel;
  notes: string;
}

// ---------------------------------------------------------------------------
// Runtime profile
// ---------------------------------------------------------------------------

export interface RuntimeProfile {
  id: string;
  agentId: string;
  adapter: AgentAdapterType;
  modelName: string;
  modelTier: ModelTier;
  heartbeatMode: string;
  heartbeatInterval: number;
  cronJobs: string[];
  sandboxMode: boolean;
  accessProfile: string;
  environmentStatus: string;
  exporterVersion: string;
}

// ---------------------------------------------------------------------------
// Audit / drift report
// ---------------------------------------------------------------------------

export interface AuditDriftReport {
  id: string;
  agentId: string;
  blueprintVersion: string;
  liveVersion: string;
  driftScore: number;
  missingFields: string[];
  mismatchedFields: string[];
  staleFields: string[];
  lastAuditedAt: string;
  stewardRecommendations: string[];
}

// ---------------------------------------------------------------------------
// Memory source
// ---------------------------------------------------------------------------

export interface MemorySource {
  id: string;
  agentId: string;
  name: string;
  type: MemorySourceType;
  path: string;
  readPermission: boolean;
  writePermission: boolean;
  lastRefresh: string;
  freshnessScore: number;
  dependencies: string[];
}

// ---------------------------------------------------------------------------
// Cognitive health
// ---------------------------------------------------------------------------

export interface CognitiveHealth {
  agentId: string;
  alignmentScore: number;
  driftScore: number;
  completenessScore: number;
  toolPolicyCoverage: number;
  delegationCoverage: number;
  lastAssessed: string;
}

// ---------------------------------------------------------------------------
// Dashboard metrics
// ---------------------------------------------------------------------------

export interface DashboardMetrics {
  cognitiveHealthScore: number;
  driftCount: number;
  delegationEfficiency: number;
  toolUsageSummary: Record<string, number>;
  runtimeWarnings: string[];
  stewardRecommendations: string[];
}

// ---------------------------------------------------------------------------
// Composite: full cognitive data for an agent
// ---------------------------------------------------------------------------

export interface AgentCognitiveData {
  agentId: string;
  agentName: string;
  agentRole: AgentRole;
  profile: AgentCognitiveProfile;
  skillChains: SkillChain[];
  toolPolicies: ToolPolicy[];
  delegationPolicies: DelegationPolicy[];
  runtimeProfile: RuntimeProfile;
  auditDriftReport: AuditDriftReport;
  memorySources: MemorySource[];
  cognitiveHealth: CognitiveHealth;
}
