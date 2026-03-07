import { Link } from "@/lib/router";
import { Info, AlertTriangle, AlertOctagon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AgentCognitiveData } from "@paperclipai/shared";

interface Recommendation {
  severity: "info" | "warning" | "critical";
  title: string;
  description: string;
  agentName: string;
  agentId: string;
}

interface StewardRecommendationsProps {
  agents: AgentCognitiveData[];
  recommendations: string[];
}

function deriveRecommendations(
  agents: AgentCognitiveData[],
  globalRecs: string[],
): Recommendation[] {
  const results: Recommendation[] = [];

  // Derive recommendations from agent drift reports
  for (const agent of agents) {
    const drift = agent.auditDriftReport;
    if (drift.driftScore >= 0.25) {
      results.push({
        severity: "critical",
        title: `${agent.agentName} has significant blueprint drift`,
        description: `Drift score ${(drift.driftScore * 100).toFixed(0)}% - blueprint v${drift.blueprintVersion} vs live v${drift.liveVersion}. ${drift.mismatchedFields.length} mismatched fields.`,
        agentName: agent.agentName,
        agentId: agent.agentId,
      });
    } else if (drift.driftScore >= 0.1) {
      results.push({
        severity: "warning",
        title: `${agent.agentName} needs blueprint re-sync`,
        description: drift.stewardRecommendations[0] ?? `Drift score ${(drift.driftScore * 100).toFixed(0)}%`,
        agentName: agent.agentName,
        agentId: agent.agentId,
      });
    }

    if (agent.profile.healthStatus === "blocked") {
      results.push({
        severity: "critical",
        title: `${agent.agentName} is blocked`,
        description: `Health status is blocked. Environment: ${agent.runtimeProfile.environmentStatus}`,
        agentName: agent.agentName,
        agentId: agent.agentId,
      });
    }
  }

  // Add global recommendations as info
  for (const rec of globalRecs) {
    // Try to match agent name in the recommendation text
    const matchedAgent = agents.find((a) => rec.includes(a.agentName));
    results.push({
      severity: rec.toLowerCase().includes("critical") || rec.toLowerCase().includes("block")
        ? "critical"
        : rec.toLowerCase().includes("review") || rec.toLowerCase().includes("re-sync")
          ? "warning"
          : "info",
      title: rec,
      description: "",
      agentName: matchedAgent?.agentName ?? "",
      agentId: matchedAgent?.agentId ?? "",
    });
  }

  // Deduplicate by title
  const seen = new Set<string>();
  return results.filter((r) => {
    if (seen.has(r.title)) return false;
    seen.add(r.title);
    return true;
  });
}

const severityConfig = {
  info: {
    icon: Info,
    badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",
    border: "border-blue-200 dark:border-blue-800/40",
  },
  warning: {
    icon: AlertTriangle,
    badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300",
    border: "border-amber-200 dark:border-amber-800/40",
  },
  critical: {
    icon: AlertOctagon,
    badge: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300",
    border: "border-red-200 dark:border-red-800/40",
  },
} as const;

export function StewardRecommendations({ agents, recommendations }: StewardRecommendationsProps) {
  const items = deriveRecommendations(agents, recommendations);

  if (items.length === 0) return null;

  return (
    <div>
      <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
        Steward Recommendations
      </h3>
      <div className="space-y-2">
        {items.map((item, i) => {
          const config = severityConfig[item.severity];
          const Icon = config.icon;
          return (
            <div
              key={i}
              className={cn(
                "border rounded-lg px-4 py-3 flex items-start gap-3",
                config.border,
              )}
            >
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium shrink-0 mt-0.5",
                  config.badge,
                )}
              >
                <Icon className="h-3 w-3 mr-1" />
                {item.severity}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{item.title}</p>
                {item.description && (
                  <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                )}
                {item.agentId && (
                  <Link
                    to={`/agents/${item.agentId}`}
                    className="text-xs text-primary hover:underline mt-1 inline-block"
                  >
                    View {item.agentName}
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
