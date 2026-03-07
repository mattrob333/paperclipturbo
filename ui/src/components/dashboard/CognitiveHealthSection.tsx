import { ShieldCheck, AlertTriangle, Wrench, Bell } from "lucide-react";
import { MetricCard } from "../MetricCard";
import type { DashboardMetrics, AgentCognitiveData } from "@paperclipai/shared";

interface CognitiveHealthSectionProps {
  metrics: DashboardMetrics;
  agents: AgentCognitiveData[];
}

export function CognitiveHealthSection({ metrics, agents }: CognitiveHealthSectionProps) {
  const alignmentScore = Math.round(metrics.cognitiveHealthScore * 100);
  const alignedCount = agents.filter(
    (a) => a.cognitiveHealth.alignmentScore >= 0.8,
  ).length;

  const driftedAgents = agents.filter((a) => a.profile.driftStatus > 0.1);

  const toolPolicyCoverage = Math.round(
    (agents.reduce((sum, a) => sum + a.cognitiveHealth.toolPolicyCoverage, 0) /
      agents.length) *
      100,
  );
  const toolGaps = agents.filter(
    (a) => a.cognitiveHealth.toolPolicyCoverage < 1.0,
  ).length;

  const criticalWarnings = metrics.runtimeWarnings.filter(
    (w) => w.toLowerCase().includes("blocked") || w.toLowerCase().includes("critical"),
  ).length;
  const otherWarnings = metrics.runtimeWarnings.length - criticalWarnings;

  return (
    <div>
      <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
        Cognitive Health
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="border border-border rounded-lg">
          <MetricCard
            icon={ShieldCheck}
            value={`${alignmentScore}%`}
            label="Agent Alignment"
            description={
              <span className={alignmentScore >= 80 ? "text-green-500" : alignmentScore >= 60 ? "text-yellow-500" : "text-red-500"}>
                {alignedCount} of {agents.length} agents aligned
              </span>
            }
          />
        </div>
        <div className="border border-border rounded-lg">
          <MetricCard
            icon={AlertTriangle}
            value={driftedAgents.length}
            label="Prompt Drift"
            description={
              <span className={driftedAgents.length > 0 ? "text-amber-500" : "text-green-500"}>
                {driftedAgents.length} agent{driftedAgents.length !== 1 ? "s" : ""} need{driftedAgents.length === 1 ? "s" : ""} review
              </span>
            }
          />
        </div>
        <div className="border border-border rounded-lg">
          <MetricCard
            icon={Wrench}
            value={`${toolPolicyCoverage}%`}
            label="Tool Policy Coverage"
            description={
              <span>
                {toolGaps} gap{toolGaps !== 1 ? "s" : ""} detected
              </span>
            }
          />
        </div>
        <div className="border border-border rounded-lg">
          <MetricCard
            icon={Bell}
            value={metrics.runtimeWarnings.length}
            label="Runtime Warnings"
            description={
              <span className={criticalWarnings > 0 ? "text-red-500" : "text-muted-foreground/70"}>
                {criticalWarnings} critical, {otherWarnings} warning
              </span>
            }
          />
        </div>
      </div>
    </div>
  );
}
