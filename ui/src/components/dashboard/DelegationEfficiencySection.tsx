import { CheckCircle, Repeat, ArrowRight, Clock } from "lucide-react";
import { MetricCard } from "../MetricCard";
import type { DashboardMetrics, AgentCognitiveData } from "@paperclipai/shared";

interface DelegationEfficiencySectionProps {
  metrics: DashboardMetrics;
  agents: AgentCognitiveData[];
}

export function DelegationEfficiencySection({ metrics, agents }: DelegationEfficiencySectionProps) {
  const routeSuccess = Math.round(metrics.delegationEfficiency * 100);

  // Compute average handoffs from delegation policies
  const totalDelegations = agents.reduce(
    (sum, a) => sum + a.delegationPolicies.filter((d) => d.ownershipMode === "delegates").length,
    0,
  );
  const avgHandoffs = agents.length > 0 ? (totalDelegations / agents.length).toFixed(1) : "0";

  // Find the most common delegation path
  const routeCounts = new Map<string, number>();
  for (const agent of agents) {
    for (const dp of agent.delegationPolicies) {
      if (dp.delegateTo) {
        const target = agents.find((a) => a.agentId === dp.delegateTo);
        const path = `${agent.agentName} -> ${target?.agentName ?? "?"}`;
        routeCounts.set(path, (routeCounts.get(path) ?? 0) + 1);
      }
    }
  }
  let topRoute = "None";
  let topRouteCount = 0;
  for (const [route, count] of routeCounts) {
    if (count > topRouteCount) {
      topRoute = route;
      topRouteCount = count;
    }
  }

  // Find bottleneck: agent with highest tool usage count (proxy for queue depth)
  let bottleneckAgent = agents[0];
  let maxToolUsage = 0;
  for (const agent of agents) {
    const usage = agent.toolPolicies.reduce((sum, tp) => sum + tp.usageCount, 0);
    if (usage > maxToolUsage) {
      maxToolUsage = usage;
      bottleneckAgent = agent;
    }
  }

  return (
    <div>
      <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
        Delegation Efficiency
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="border border-border rounded-lg">
          <MetricCard
            icon={CheckCircle}
            value={`${routeSuccess}%`}
            label="Route Success"
            description={<span>First-pass routing success</span>}
          />
        </div>
        <div className="border border-border rounded-lg">
          <MetricCard
            icon={Repeat}
            value={avgHandoffs}
            label="Avg Handoffs"
            description={<span>Per task (lower is better)</span>}
          />
        </div>
        <div className="border border-border rounded-lg">
          <MetricCard
            icon={ArrowRight}
            value={topRoute}
            label="Top Route"
            description={<span>Most common delegation path</span>}
          />
        </div>
        <div className="border border-border rounded-lg">
          <MetricCard
            icon={Clock}
            value={bottleneckAgent?.agentName ?? "-"}
            label="Bottleneck"
            description={
              <span>
                {maxToolUsage.toLocaleString()} tool calls queued
              </span>
            }
          />
        </div>
      </div>
    </div>
  );
}
