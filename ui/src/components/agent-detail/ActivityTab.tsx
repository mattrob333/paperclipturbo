import { Link } from "@/lib/router";
import { StatusBadge } from "../StatusBadge";
import {
  CheckCircle2,
  XCircle,
  Clock,
  Timer,
  Loader2,
  Slash,
  Wrench,
  AlertTriangle,
  ThumbsUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { relativeTime, formatTokens } from "@/lib/utils";
import type { HeartbeatRun } from "@paperclipai/shared";

interface ActivityTabProps {
  runs: HeartbeatRun[];
  agentRouteId: string;
}

const runStatusIcons: Record<string, { icon: typeof CheckCircle2; color: string }> = {
  succeeded: { icon: CheckCircle2, color: "text-green-600 dark:text-green-400" },
  failed: { icon: XCircle, color: "text-red-600 dark:text-red-400" },
  running: { icon: Loader2, color: "text-cyan-600 dark:text-cyan-400" },
  queued: { icon: Clock, color: "text-yellow-600 dark:text-yellow-400" },
  timed_out: { icon: Timer, color: "text-orange-600 dark:text-orange-400" },
  cancelled: { icon: Slash, color: "text-neutral-500 dark:text-neutral-400" },
};

const sourceLabels: Record<string, string> = {
  timer: "Timer",
  assignment: "Assignment",
  on_demand: "On-demand",
  automation: "Automation",
};

function usageNumber(usage: Record<string, unknown> | null, ...keys: string[]) {
  if (!usage) return 0;
  for (const key of keys) {
    const value = usage[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return 0;
}

export function ActivityTab({ runs, agentRouteId }: ActivityTabProps) {
  const sorted = [...runs].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  if (sorted.length === 0) {
    return <p className="text-sm text-muted-foreground">No activity yet.</p>;
  }

  // Aggregate stats
  const succeeded = sorted.filter((r) => r.status === "succeeded").length;
  const failed = sorted.filter((r) => r.status === "failed").length;
  const timedOut = sorted.filter((r) => r.status === "timed_out").length;
  const errors = sorted.filter((r) => r.error).length;

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="border border-border rounded-lg px-4 py-3">
          <span className="text-2xl font-bold text-green-600 dark:text-green-400">{succeeded}</span>
          <span className="text-xs text-muted-foreground block">Succeeded</span>
        </div>
        <div className="border border-border rounded-lg px-4 py-3">
          <span className="text-2xl font-bold text-red-600 dark:text-red-400">{failed}</span>
          <span className="text-xs text-muted-foreground block">Failed</span>
        </div>
        <div className="border border-border rounded-lg px-4 py-3">
          <span className="text-2xl font-bold text-orange-600 dark:text-orange-400">{timedOut}</span>
          <span className="text-xs text-muted-foreground block">Timed Out</span>
        </div>
        <div className="border border-border rounded-lg px-4 py-3">
          <span className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{errors}</span>
          <span className="text-xs text-muted-foreground block">With Errors</span>
        </div>
      </div>

      {/* Run history table */}
      <div className="border border-border rounded-lg overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border bg-accent/20">
              <th className="text-left px-3 py-2 font-medium text-muted-foreground">Status</th>
              <th className="text-left px-3 py-2 font-medium text-muted-foreground">Run ID</th>
              <th className="text-left px-3 py-2 font-medium text-muted-foreground">Source</th>
              <th className="text-right px-3 py-2 font-medium text-muted-foreground">Tokens</th>
              <th className="text-right px-3 py-2 font-medium text-muted-foreground">Cost</th>
              <th className="text-left px-3 py-2 font-medium text-muted-foreground">Error</th>
              <th className="text-right px-3 py-2 font-medium text-muted-foreground">When</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((run) => {
              const statusInfo = runStatusIcons[run.status] ?? { icon: Clock, color: "text-neutral-400" };
              const StatusIcon = statusInfo.icon;
              const usage = (run.usageJson ?? null) as Record<string, unknown> | null;
              const input = usageNumber(usage, "inputTokens", "input_tokens");
              const output = usageNumber(usage, "outputTokens", "output_tokens");
              const cost =
                usageNumber(usage, "costUsd", "cost_usd", "total_cost_usd") ||
                usageNumber((run.resultJson ?? null) as Record<string, unknown> | null, "total_cost_usd", "cost_usd", "costUsd");

              return (
                <tr key={run.id} className="border-b border-border last:border-b-0 hover:bg-accent/20">
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      <StatusIcon className={cn("h-3 w-3", statusInfo.color, run.status === "running" && "animate-spin")} />
                      <StatusBadge status={run.status} />
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <Link
                      to={`/agents/${agentRouteId}/runs/${run.id}`}
                      className="font-mono text-blue-600 hover:underline dark:text-blue-400 no-underline"
                    >
                      {run.id.slice(0, 8)}
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    <span className={cn(
                      "inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                      run.invocationSource === "timer" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300"
                        : run.invocationSource === "assignment" ? "bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300"
                        : run.invocationSource === "on_demand" ? "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/50 dark:text-cyan-300"
                        : "bg-muted text-muted-foreground"
                    )}>
                      {sourceLabels[run.invocationSource] ?? run.invocationSource}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    {input + output > 0 ? formatTokens(input + output) : "-"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {cost > 0 ? `$${cost.toFixed(4)}` : "-"}
                  </td>
                  <td className="px-3 py-2 max-w-[200px]">
                    {run.error ? (
                      <span className="text-red-600 dark:text-red-400 truncate block">{run.error.slice(0, 50)}</span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right text-muted-foreground whitespace-nowrap">
                    {relativeTime(run.createdAt)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
