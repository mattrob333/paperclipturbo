/** What the user provides to start discovery */
export interface AttachRequest {
  gatewayUrl: string;
  workspacePath: string;
  companyName: string;
  companyDescription?: string;
}

/** A single discovered agent from the workspace */
export interface DiscoveredAgent {
  name: string;
  role: string;
  folder: string;
  files: DiscoveredFile[];
  status: "complete" | "partial" | "missing";
}

/** A file found during discovery */
export interface DiscoveredFile {
  name: string;
  exists: boolean;
  sizeBytes?: number;
}

/** Result of workspace discovery (returned by discover endpoint) */
export interface DiscoveryResult {
  workspacePath: string;
  gatewayUrl: string;
  gatewayHealthy: boolean;
  gatewayError?: string;
  configFound: boolean;
  configPath?: string;
  agents: DiscoveredAgent[];
  workspaceVersion?: string;
  workspaceName?: string;
  overallStatus: "ready" | "incomplete" | "invalid";
  issues: string[];
}

/** Result of confirming an attach (returned by confirm endpoint) */
export interface AttachResult {
  companyId: string;
  companyName: string;
  issuePrefix: string;
  agentsCreated: number;
  gatewayUrl: string;
  workspacePath: string;
  provisioningMode: "attach";
}

/** Provisioning mode discriminator */
export type ProvisioningMode = "cold_start" | "attach";
