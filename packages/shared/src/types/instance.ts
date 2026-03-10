export interface OpenClawInstanceAgent {
  roleId: string;
  folderName: string;
  workspacePath: string;
  files: string[];
  heartbeatConfig: {
    mode: "on-demand" | "scheduled" | "continuous";
    intervalSec: number;
  } | null;
  lastFileHash: string | null;
}

export interface OpenClawInstanceConfig {
  workspacePath: string;
  instanceName: string | null;
  environment: "development" | "staging" | "production";
  status: "not_provisioned" | "provisioned" | "connected" | "validated" | "error";
  agents: OpenClawInstanceAgent[];
  configPath: string | null;
  heartbeatMode: "on-demand" | "scheduled" | "continuous";
  fileSyncMode: "manual" | "auto" | "watch";
}

export interface PaperclipLinkageConfig {
  companyId: string | null;
  apiBase: string;
  importBundlePath: string | null;
  status: "not_imported" | "imported" | "synced" | "drift_detected";
  agentIdMap: Record<string, string>;
}

export interface SyncDriftItem {
  type: string;
  description: string;
  filePath: string | null;
}

export interface SyncState {
  lastSyncAt: string | null;
  lastSyncStatus: "success" | "partial" | "failed" | "never";
  driftItems: SyncDriftItem[];
}

export interface InstanceManifest {
  schemaVersion: number;
  companyId: string;
  companyName: string;
  blueprintVersion: string;
  blueprintPath: string;
  sourceOfTruth: "blueprint" | "developer_mode";
  openclaw: OpenClawInstanceConfig;
  paperclip: PaperclipLinkageConfig;
  sync: SyncState;
  createdAt: string;
  updatedAt: string;
}

export interface InstanceSummary {
  companyId: string;
  companyName: string;
  openclawStatus: OpenClawInstanceConfig["status"];
  paperclipStatus: PaperclipLinkageConfig["status"];
  lastSync: string | null;
}

export interface ProvisionRequest {
  companySlug: string;
  mode: "new" | "existing" | "export_only";
  workspacePath?: string;
  instanceName?: string;
  environment?: "development" | "staging" | "production";
  heartbeatMode?: "on-demand" | "scheduled" | "continuous";
  fileSyncMode?: "manual" | "auto" | "watch";
}

export interface ProvisionResult {
  status: "success" | "partial" | "failed";
  manifest: InstanceManifest | null;
  filesCreated: string[];
  warnings: string[];
  errors: string[];
}

export interface ConnectionCheck {
  name: string;
  status: "pass" | "fail" | "warn";
  message: string;
}

export interface ConnectionValidation {
  workspacePath: string;
  checks: ConnectionCheck[];
  overallStatus: "pass" | "fail" | "warn";
}
