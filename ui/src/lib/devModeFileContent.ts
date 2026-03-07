import type { AgentCognitiveData } from "@paperclipai/shared";
import { mockAgentCognitiveData } from "./mockCognitiveData";

/** Agent slug to display name map */
const AGENT_SLUGS: Record<string, string> = {
  "atlas-ceo": "agent-ceo-001",
  "forge-cto": "agent-cto-002",
  "bolt-engineer": "agent-eng-003",
  "prism-designer": "agent-des-004",
  "nexus-pm": "agent-pm-005",
  "sentinel-qa": "agent-qa-006",
};

function getAgentDataBySlug(slug: string): AgentCognitiveData | undefined {
  const agentId = AGENT_SLUGS[slug];
  if (!agentId) return undefined;
  return mockAgentCognitiveData.find((a) => a.agentId === agentId);
}

function generateSoulMd(data: AgentCognitiveData): string {
  const p = data.profile;
  return `# ${data.agentName} - ${p.cognitiveRole}

## Mission
${p.mission}

## Identity
- **Role:** ${data.agentRole.toUpperCase()}
- **Specialization:** ${p.specialization}
- **Model Tier:** ${p.modelTier}
- **Confidence Policy:** ${p.confidencePolicy}

## Capability Tags
${p.capabilityTags.map((t) => `- ${t}`).join("\n")}

## Priority Stack
${p.priorityStack.map((s, i) => `${i + 1}. ${s}`).join("\n")}

## Decision Rules
${p.decisionRules.map((r) => `- ${r}`).join("\n")}

## Reasoning Sequence
${p.reasoningSequence.map((s, i) => `${i + 1}. ${s}`).join("\n")}

## Escalation Triggers
${p.escalationTriggers.map((t) => `- ${t}`).join("\n")}

## Anti-Patterns
${p.antiPatterns.map((a) => `- ${a}`).join("\n")}

## Boundary Rules
${p.boundaryRules.map((b) => `- ${b}`).join("\n")}

## Edge Case Rules
${p.edgeCaseRules.map((e) => `- ${e}`).join("\n")}
`;
}

function generateAgentsMd(data: AgentCognitiveData): string {
  const delegations = data.delegationPolicies;
  return `# ${data.agentName} - Agent Relationships

## Delegation Map
${delegations
  .map(
    (d) =>
      `### ${d.taskClass}
- **Mode:** ${d.ownershipMode}
- **Delegate To:** ${d.delegateTo ?? "N/A"}
- **Escalate To:** ${d.escalateTo ?? "N/A"}
- **Approval Required:** ${d.approvalRequired ? "Yes" : "No"}
- **Confidence Threshold:** ${d.confidenceThreshold}
- **Notes:** ${d.notes}`,
  )
  .join("\n\n")}

## Memory Sources
${data.memorySources
  .map(
    (m) =>
      `- **${m.name}** (${m.type}) - ${m.path}
  Read: ${m.readPermission ? "Yes" : "No"} | Write: ${m.writePermission ? "Yes" : "No"} | Freshness: ${(m.freshnessScore * 100).toFixed(0)}%`,
  )
  .join("\n")}
`;
}

function generateToolsJson(data: AgentCognitiveData): string {
  const tools = data.toolPolicies.map((t) => ({
    name: t.toolName,
    permission: t.permissionLevel,
    usageConditions: t.usageConditions,
    doNotUse: t.doNotUseConditions,
    fallback: t.fallbackBehavior,
    preconditions: t.preconditions,
    stats: {
      successRate: t.successRate,
      failureRate: t.failureRate,
      usageCount: t.usageCount,
    },
    lastUpdated: t.lastUpdated,
  }));
  return JSON.stringify({ agentId: data.agentId, tools }, null, 2);
}

function generatePoliciesJson(data: AgentCognitiveData): string {
  const policies = data.delegationPolicies.map((d) => ({
    taskClass: d.taskClass,
    ownershipMode: d.ownershipMode,
    delegateTo: d.delegateTo,
    escalateTo: d.escalateTo,
    approvalRequired: d.approvalRequired,
    confidenceThreshold: d.confidenceThreshold,
    notes: d.notes,
  }));
  return JSON.stringify({ agentId: data.agentId, delegationPolicies: policies }, null, 2);
}

function generateHeartbeatJson(data: AgentCognitiveData): string {
  const rt = data.runtimeProfile;
  return JSON.stringify(
    {
      agentId: data.agentId,
      heartbeatMode: rt.heartbeatMode,
      heartbeatInterval: rt.heartbeatInterval,
      lastBeat: new Date().toISOString(),
      status: data.profile.healthStatus,
      cronJobs: rt.cronJobs,
    },
    null,
    2,
  );
}

function generateRuntimeJson(data: AgentCognitiveData): string {
  const rt = data.runtimeProfile;
  return JSON.stringify(
    {
      agentId: data.agentId,
      adapter: rt.adapter,
      modelName: rt.modelName,
      modelTier: rt.modelTier,
      sandboxMode: rt.sandboxMode,
      accessProfile: rt.accessProfile,
      environmentStatus: rt.environmentStatus,
      exporterVersion: rt.exporterVersion,
      cognitiveHealth: {
        alignmentScore: data.cognitiveHealth.alignmentScore,
        driftScore: data.cognitiveHealth.driftScore,
        completenessScore: data.cognitiveHealth.completenessScore,
        toolPolicyCoverage: data.cognitiveHealth.toolPolicyCoverage,
        delegationCoverage: data.cognitiveHealth.delegationCoverage,
      },
    },
    null,
    2,
  );
}

const BLUEPRINT_COMPANY_JSON = JSON.stringify(
  {
    name: "Paperclip AI",
    version: "2.1.0",
    agentCount: 6,
    modelStrategy: "tiered",
    governanceModel: "hierarchical_delegation",
    exportFormat: "cognitive_blueprint_v2",
  },
  null,
  2,
);

const BLUEPRINT_ORG_JSON = JSON.stringify(
  {
    hierarchy: {
      root: "agent-ceo-001",
      children: [
        {
          id: "agent-cto-002",
          children: [
            { id: "agent-eng-003", children: [] },
            { id: "agent-qa-006", children: [] },
          ],
        },
        { id: "agent-des-004", children: [] },
        { id: "agent-pm-005", children: [] },
      ],
    },
    delegationFlow: "top-down with escalation paths",
    crossTeamRules: ["PM routes all cross-team requests", "CTO arbitrates technical disputes"],
  },
  null,
  2,
);

const BLUEPRINT_DELEGATION_MAP = JSON.stringify(
  {
    version: "2.1.0",
    rules: [
      { from: "CEO", to: "CTO", taskClasses: ["technical_architecture", "code_review"] },
      { from: "CEO", to: "Designer", taskClasses: ["design_review", "ux_research"] },
      { from: "CEO", to: "PM", taskClasses: ["project_coordination", "task_triage"] },
      { from: "CTO", to: "Engineer", taskClasses: ["feature_implementation", "bug_fix"] },
      { from: "CTO", to: "QA", taskClasses: ["testing", "release_validation"] },
      { from: "PM", to: "Engineer", taskClasses: ["bug_fix"] },
      { from: "PM", to: "Designer", taskClasses: ["design_request"] },
      { from: "PM", to: "QA", taskClasses: ["qa_validation"] },
    ],
  },
  null,
  2,
);

const EXPORTS_MANIFEST = JSON.stringify(
  {
    exportedAt: new Date().toISOString(),
    format: "cognitive_blueprint_v2",
    agents: 6,
    totalFiles: 36,
    checksumAlgorithm: "sha256",
    includesRuntime: true,
    includesAudit: true,
  },
  null,
  2,
);

export function generateFileContent(filePath: string): string {
  // Blueprint files
  if (filePath === "blueprints/company.json") return BLUEPRINT_COMPANY_JSON;
  if (filePath === "blueprints/org-structure.json") return BLUEPRINT_ORG_JSON;
  if (filePath === "blueprints/delegation-map.json") return BLUEPRINT_DELEGATION_MAP;
  if (filePath === "exports/manifest.json") return EXPORTS_MANIFEST;

  // Agent files
  const match = filePath.match(/^agents\/([^/]+)\/(.+)$/);
  if (!match) return `// File not found: ${filePath}`;

  const [, agentSlug, fileName] = match;
  const data = getAgentDataBySlug(agentSlug!);
  if (!data) return `// Unknown agent: ${agentSlug}`;

  switch (fileName) {
    case "SOUL.md":
      return generateSoulMd(data);
    case "AGENTS.md":
      return generateAgentsMd(data);
    case "tools.json":
      return generateToolsJson(data);
    case "policies.json":
      return generatePoliciesJson(data);
    case "heartbeat.json":
      return generateHeartbeatJson(data);
    case "runtime.json":
      return generateRuntimeJson(data);
    default:
      return `// Unknown file: ${fileName}`;
  }
}

export interface FileTreeNode {
  name: string;
  path: string;
  type: "file" | "folder";
  children?: FileTreeNode[];
}

const AGENT_FILES = ["SOUL.md", "AGENTS.md", "tools.json", "policies.json", "heartbeat.json", "runtime.json"];

const AGENT_FOLDERS: { slug: string; label: string }[] = [
  { slug: "atlas-ceo", label: "atlas-ceo" },
  { slug: "forge-cto", label: "forge-cto" },
  { slug: "bolt-engineer", label: "bolt-engineer" },
  { slug: "prism-designer", label: "prism-designer" },
  { slug: "nexus-pm", label: "nexus-pm" },
  { slug: "sentinel-qa", label: "sentinel-qa" },
];

export const FILE_TREE: FileTreeNode[] = [
  {
    name: "agents",
    path: "agents",
    type: "folder",
    children: AGENT_FOLDERS.map((a) => ({
      name: a.label,
      path: `agents/${a.slug}`,
      type: "folder" as const,
      children: AGENT_FILES.map((f) => ({
        name: f,
        path: `agents/${a.slug}/${f}`,
        type: "file" as const,
      })),
    })),
  },
  {
    name: "blueprints",
    path: "blueprints",
    type: "folder",
    children: [
      { name: "company.json", path: "blueprints/company.json", type: "file" },
      { name: "org-structure.json", path: "blueprints/org-structure.json", type: "file" },
      { name: "delegation-map.json", path: "blueprints/delegation-map.json", type: "file" },
    ],
  },
  {
    name: "exports",
    path: "exports",
    type: "folder",
    children: [{ name: "manifest.json", path: "exports/manifest.json", type: "file" }],
  },
];

/** Get the agent slug from a file path, e.g. "agents/atlas-ceo/SOUL.md" => "atlas-ceo" */
export function getAgentSlugFromPath(filePath: string): string | null {
  const match = filePath.match(/^agents\/([^/]+)\//);
  return match?.[1] ?? null;
}

/** Get display name for an agent slug */
export function getAgentDisplayName(slug: string): string | null {
  const data = getAgentDataBySlug(slug);
  return data?.agentName ?? null;
}

/** Get agent data for inspector panel */
export function getAgentDataForInspector(slug: string) {
  return getAgentDataBySlug(slug);
}
