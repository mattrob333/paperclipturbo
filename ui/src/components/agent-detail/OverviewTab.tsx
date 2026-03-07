import { Link } from "@/lib/router";
import { StatusBadge } from "../StatusBadge";
import { MetricCard } from "../MetricCard";
import {
  Target,
  Activity,
  Shield,
  Gauge,
  Users,
  DollarSign,
  AlertTriangle,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { relativeTime } from "@/lib/utils";
import type { AgentCognitiveData } from "@paperclipai/shared";
import type { Agent, HeartbeatRun, AgentRuntimeState } from "@paperclipai/shared";
import { deriveAgentSetupState } from "@paperclipai/shared";
import { AgentSetupBadge } from "../AgentSetupBadge";

interface OverviewTabProps {
  agent: Agent;
  cognitiveData: AgentCognitiveData | undefined;
  runs: HeartbeatRun[];
  runtimeState?: AgentRuntimeState;
  agentRouteId: string;
}

const healthColors: Record<string, string> = {
  healthy: "text-green-600 dark:text-green-400",
  warning: "text-yellow-600 dark:text-yellow-400",
  drifted: "text-orange-600 dark:text-orange-400",
  stale: "text-muted-foreground",
  blocked: "text-red-600 dark:text-red-400",
  degraded: "text-red-600 dark:text-red-400",
};

const healthBg: Record<string, string> = {
  healthy: "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300",
  warning: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300",
  drifted: "bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300",
  stale: "bg-muted text-muted-foreground",
  blocked: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300",
  degraded: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300",
};

export function OverviewTab({ agent, cognitiveData, runs, runtimeState, agentRouteId }: OverviewTabProps) {
  const profile = cognitiveData?.profile;
  const health = cognitiveData?.cognitiveHealth;
  const setupInfo = deriveAgentSetupState({ agent, runtimeState });

  const recentRuns = [...runs]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  const succeededCount = runs.filter((r) => r.status === "succeeded").length;
  const failedCount = runs.filter((r) => r.status === "failed").length;
  const successRate = runs.length > 0 ? Math.round((succeededCount / runs.length) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Mission Statement */}
      {profile && (
        <div className="border border-border rounded-lg p-4 space-y-3">
          <div className="flex items-start gap-3">
            <Target className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <div className="space-y-1 min-w-0">
              <h3 className="text-sm font-medium">Mission</h3>
              <p className="text-sm text-muted-foreground">{profile.mission}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {profile.capabilityTags.map((tag) => (
              <Badge key={tag} variant="secondary" className="text-[11px]">
                {tag}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Setup State (shown when no cognitive profile) */}
      {!profile && (
        <div className="border border-border rounded-lg p-4 flex items-center justify-between">
          <div className="space-y-0.5">
            <h3 className="text-sm font-medium">Setup Status</h3>
            {setupInfo.actionHint && (
              <p className="text-xs text-muted-foreground">{setupInfo.actionHint}</p>
            )}
          </div>
          <AgentSetupBadge state={setupInfo.state} />
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="border border-border rounded-lg">
          <MetricCard
            icon={Activity}
            value={runs.length}
            label="Total Runs"
            description={`${succeededCount} succeeded, ${failedCount} failed`}
            to={`/agents/${agentRouteId}/activity`}
          />
        </div>
        <div className="border border-border rounded-lg">
          <MetricCard
            icon={Gauge}
            value={`${successRate}%`}
            label="Success Rate"
          />
        </div>
        {health && (
          <div className="border border-border rounded-lg">
            <MetricCard
              icon={Shield}
              value={`${Math.round(health.alignmentScore * 100)}%`}
              label="Alignment"
              description={
                <span className={healthColors[profile?.healthStatus ?? "healthy"]}>
                  {profile?.healthStatus ?? "unknown"}
                </span>
              }
            />
          </div>
        )}
        {profile && (
          <div className="border border-border rounded-lg">
            <MetricCard
              icon={Zap}
              value={profile.toolCount}
              label="Tools"
              description={`${profile.modelTier} tier`}
            />
          </div>
        )}
      </div>

      {/* Health & Authority */}
      {profile && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="border border-border rounded-lg p-4 space-y-3">
            <h3 className="text-sm font-medium">Health & Status</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-xs">Health</span>
                <span className={cn(
                  "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                  healthBg[profile.healthStatus] ?? "bg-muted text-muted-foreground"
                )}>
                  {profile.healthStatus}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-xs">Setup</span>
                <AgentSetupBadge state={setupInfo.state} />
              </div>
              {setupInfo.actionHint && (
                <p className="text-[11px] text-muted-foreground italic">{setupInfo.actionHint}</p>
              )}
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-xs">Drift</span>
                <span className={cn(
                  "text-xs font-mono",
                  profile.driftStatus > 0.2 ? "text-red-600 dark:text-red-400"
                    : profile.driftStatus > 0.1 ? "text-yellow-600 dark:text-yellow-400"
                    : "text-green-600 dark:text-green-400"
                )}>
                  {(profile.driftStatus * 100).toFixed(0)}%
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-xs">Blueprint</span>
                <span className="text-xs font-mono">{profile.blueprintVersion}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-xs">Last Sync</span>
                <span className="text-xs">{relativeTime(profile.lastSyncAt)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-xs">Confidence Policy</span>
                <Badge variant="outline" className="text-[11px]">{profile.confidencePolicy}</Badge>
              </div>
            </div>
          </div>

          <div className="border border-border rounded-lg p-4 space-y-3">
            <h3 className="text-sm font-medium">Cognitive Role</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-xs">Role</span>
                <span className="text-xs">{profile.cognitiveRole}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-xs">Specialization</span>
                <span className="text-xs text-right max-w-[60%]">{profile.specialization}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-xs">Model Tier</span>
                <Badge variant="outline" className="text-[11px]">{profile.modelTier}</Badge>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recent Runs */}
      {recentRuns.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">Recent Runs</h3>
            <Link
              to={`/agents/${agentRouteId}/activity`}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors no-underline"
            >
              View all &rarr;
            </Link>
          </div>
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-accent/20">
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Status</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Run</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Source</th>
                  <th className="text-right px-3 py-2 font-medium text-muted-foreground">When</th>
                </tr>
              </thead>
              <tbody>
                {recentRuns.map((run) => (
                  <tr key={run.id} className="border-b border-border last:border-b-0">
                    <td className="px-3 py-2"><StatusBadge status={run.status} /></td>
                    <td className="px-3 py-2 font-mono">{run.id.slice(0, 8)}</td>
                    <td className="px-3 py-2">{run.invocationSource}</td>
                    <td className="px-3 py-2 text-right text-muted-foreground">{relativeTime(run.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Health Events */}
      {cognitiveData && cognitiveData.auditDriftReport.stewardRecommendations.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium flex items-center gap-2">
            <AlertTriangle className="h-3.5 w-3.5 text-yellow-600 dark:text-yellow-400" />
            Steward Recommendations
          </h3>
          <div className="space-y-2">
            {cognitiveData.auditDriftReport.stewardRecommendations.map((rec, i) => (
              <div key={i} className="flex items-start gap-2 border border-border rounded-lg p-3">
                <AlertTriangle className="h-3.5 w-3.5 text-yellow-600 dark:text-yellow-400 mt-0.5 shrink-0" />
                <span className="text-xs text-muted-foreground">{rec}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
