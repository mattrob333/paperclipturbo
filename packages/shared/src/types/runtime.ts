export interface AgentRuntimeProfile {
  adapter: string;
  model: string | null;
  modelTier: string | null;
  heartbeatEnabled: boolean;
  heartbeatInterval: number;
  lastHeartbeatAt: string | null;
  cronJobs: CronJobInfo[];
  sandboxMode: boolean;
  accessProfile: string;
  environmentStatus: string;
  sessionState: SessionState | null;
  recentRuns: RecentRunSummary[];
}

export interface CronJobInfo {
  name: string;
  schedule: string;
  enabled: boolean;
}

export interface SessionState {
  taskKey: string | null;
  sessionDisplayId: string | null;
  status: string;
  startedAt: string | null;
  lastRunId: string | null;
  lastError: string | null;
}

export interface RecentRunSummary {
  id: string;
  status: string;
  invocationSource: string;
  triggerDetail: string | null;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface ValidationItem {
  rule: string;
  severity: "error" | "warning" | "info";
  message: string;
  affectedFiles: string[];
  suggestedFix?: string;
}

export interface ConfigDiffResult {
  currentRevisionId: string | null;
  previousRevisionId: string | null;
  changedKeys: string[];
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  createdAt: string | null;
  source: string | null;
}
