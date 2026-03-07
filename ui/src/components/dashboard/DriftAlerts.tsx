import { Link } from "@/lib/router";
import { cn } from "@/lib/utils";
import { relativeTime } from "@/lib/utils";
import type { AgentCognitiveData } from "@paperclipai/shared";

interface DriftAlert {
  timestamp: string;
  agentName: string;
  agentId: string;
  driftType: string;
  severity: "low" | "medium" | "high" | "critical";
  driftScore: number;
}

function deriveDriftAlerts(agents: AgentCognitiveData[]): DriftAlert[] {
  const alerts: DriftAlert[] = [];

  for (const agent of agents) {
    const drift = agent.auditDriftReport;
    if (drift.driftScore < 0.05) continue;

    const severity: DriftAlert["severity"] =
      drift.driftScore >= 0.3
        ? "critical"
        : drift.driftScore >= 0.2
          ? "high"
          : drift.driftScore >= 0.1
            ? "medium"
            : "low";

    // Report mismatched fields
    if (drift.mismatchedFields.length > 0) {
      alerts.push({
        timestamp: drift.lastAuditedAt,
        agentName: agent.agentName,
        agentId: agent.agentId,
        driftType: `Field mismatch: ${drift.mismatchedFields.join(", ")}`,
        severity,
        driftScore: drift.driftScore,
      });
    }

    // Report missing fields
    if (drift.missingFields.length > 0) {
      alerts.push({
        timestamp: drift.lastAuditedAt,
        agentName: agent.agentName,
        agentId: agent.agentId,
        driftType: `Missing fields: ${drift.missingFields.join(", ")}`,
        severity,
        driftScore: drift.driftScore,
      });
    }

    // Report stale fields
    if (drift.staleFields.length > 0) {
      alerts.push({
        timestamp: drift.lastAuditedAt,
        agentName: agent.agentName,
        agentId: agent.agentId,
        driftType: `Stale: ${drift.staleFields.join(", ")}`,
        severity,
        driftScore: drift.driftScore,
      });
    }

    // Report version drift
    if (drift.blueprintVersion !== drift.liveVersion) {
      alerts.push({
        timestamp: drift.lastAuditedAt,
        agentName: agent.agentName,
        agentId: agent.agentId,
        driftType: `Version drift: blueprint v${drift.blueprintVersion} vs live v${drift.liveVersion}`,
        severity,
        driftScore: drift.driftScore,
      });
    }
  }

  return alerts
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 10);
}

const severityBadge: Record<DriftAlert["severity"], string> = {
  low: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",
  medium: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300",
  high: "bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300",
  critical: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300",
};

export function DriftAlerts({ agents }: { agents: AgentCognitiveData[] }) {
  const alerts = deriveDriftAlerts(agents);

  if (alerts.length === 0) return null;

  return (
    <div>
      <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
        Recent Drift Alerts
      </h3>
      <div className="border border-border divide-y divide-border overflow-hidden rounded-lg">
        {alerts.map((alert, i) => (
          <Link
            key={i}
            to={`/agents/${alert.agentId}`}
            className="px-4 py-2.5 text-sm hover:bg-accent/50 transition-colors no-underline text-inherit flex items-center gap-3"
          >
            <span className="text-xs text-muted-foreground/70 shrink-0 w-16 tabular-nums">
              {relativeTime(alert.timestamp)}
            </span>
            <span className="font-medium shrink-0 w-20 truncate">
              {alert.agentName}
            </span>
            <span className="flex-1 min-w-0 text-xs text-muted-foreground truncate">
              {alert.driftType}
            </span>
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium shrink-0",
                severityBadge[alert.severity],
              )}
            >
              {alert.severity}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
