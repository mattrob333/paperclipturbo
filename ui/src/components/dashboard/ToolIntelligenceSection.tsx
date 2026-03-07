import { Zap, XCircle, PackageOpen, BarChart3 } from "lucide-react";
import { MetricCard } from "../MetricCard";
import type { DashboardMetrics, AgentCognitiveData } from "@paperclipai/shared";

interface ToolIntelligenceSectionProps {
  metrics: DashboardMetrics;
  agents: AgentCognitiveData[];
}

export function ToolIntelligenceSection({ metrics, agents }: ToolIntelligenceSectionProps) {
  // Top 3 most used tools
  const sortedTools = Object.entries(metrics.toolUsageSummary)
    .sort(([, a], [, b]) => b - a);
  const top3 = sortedTools.slice(0, 3);

  // Tool failures: count policies with failureRate > 0.1
  const failingTools = agents.flatMap((a) =>
    a.toolPolicies.filter((tp) => tp.failureRate > 0.1),
  );

  // Unused tools: usageCount === 0
  const unusedTools = agents.flatMap((a) =>
    a.toolPolicies.filter((tp) => tp.usageCount === 0),
  );

  // Calls by agent role
  const callsByRole = new Map<string, number>();
  for (const agent of agents) {
    const totalCalls = agent.toolPolicies.reduce((sum, tp) => sum + tp.usageCount, 0);
    callsByRole.set(agent.agentRole, (callsByRole.get(agent.agentRole) ?? 0) + totalCalls);
  }
  const topRoles = [...callsByRole.entries()]
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3);

  return (
    <div>
      <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
        Tool Intelligence
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="border border-border rounded-lg px-4 py-4 sm:px-5 sm:py-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs sm:text-sm font-medium text-muted-foreground mb-2">
                Most Used
              </p>
              <div className="space-y-1">
                {top3.map(([name, count]) => (
                  <div key={name} className="flex items-center justify-between text-xs">
                    <span className="truncate font-medium">{name.replace(/_/g, " ")}</span>
                    <span className="text-muted-foreground/70 tabular-nums ml-2">{count.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
            <Zap className="h-4 w-4 text-muted-foreground/50 shrink-0 mt-1.5" />
          </div>
        </div>
        <div className="border border-border rounded-lg">
          <MetricCard
            icon={XCircle}
            value={failingTools.length}
            label="Tool Failures"
            description={
              <span className={failingTools.length > 0 ? "text-amber-500" : "text-green-500"}>
                {failingTools.length > 0 ? "High failure rate detected" : "All tools healthy"}
              </span>
            }
          />
        </div>
        <div className="border border-border rounded-lg">
          <MetricCard
            icon={PackageOpen}
            value={unusedTools.length}
            label="Unused Tools"
            description={<span>Provisioned but never called</span>}
          />
        </div>
        <div className="border border-border rounded-lg px-4 py-4 sm:px-5 sm:py-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs sm:text-sm font-medium text-muted-foreground mb-2">
                Calls by Role
              </p>
              <div className="space-y-1">
                {topRoles.map(([role, count]) => (
                  <div key={role} className="flex items-center justify-between text-xs">
                    <span className="truncate font-medium">{role.toUpperCase()}</span>
                    <span className="text-muted-foreground/70 tabular-nums ml-2">{count.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
            <BarChart3 className="h-4 w-4 text-muted-foreground/50 shrink-0 mt-1.5" />
          </div>
        </div>
      </div>
    </div>
  );
}
