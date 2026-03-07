import {
  Globe,
  FolderOpen,
  Terminal,
  Database,
  Cable,
  Wrench,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { relativeTime } from "@/lib/utils";
import type { AgentCognitiveData, ToolPolicy, ToolPermissionLevel } from "@paperclipai/shared";

interface ToolsPoliciesTabProps {
  cognitiveData: AgentCognitiveData;
}

const permissionBadge: Record<ToolPermissionLevel, { className: string; label: string }> = {
  full: {
    className: "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300",
    label: "Full",
  },
  restricted: {
    className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300",
    label: "Restricted",
  },
  read_only: {
    className: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",
    label: "Read Only",
  },
  none: {
    className: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300",
    label: "None",
  },
};

const toolCategoryIcon: Record<string, typeof Globe> = {
  web: Globe,
  file: FolderOpen,
  shell: Terminal,
  database: Database,
  api: Cable,
};

function guessToolIcon(toolName: string) {
  const lower = toolName.toLowerCase();
  if (lower.includes("db") || lower.includes("database")) return Database;
  if (lower.includes("file") || lower.includes("editor") || lower.includes("code")) return FolderOpen;
  if (lower.includes("shell") || lower.includes("cli") || lower.includes("terminal")) return Terminal;
  if (lower.includes("api") || lower.includes("messenger") || lower.includes("scanner")) return Cable;
  if (lower.includes("web") || lower.includes("dashboard") || lower.includes("monitor")) return Globe;
  return Wrench;
}

function MiniBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="h-1.5 w-16 bg-accent rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full", color)}
          style={{ width: `${Math.max(value * 100, 1)}%` }}
        />
      </div>
      <span className="text-[10px] text-muted-foreground font-mono w-8 text-right">
        {(value * 100).toFixed(0)}%
      </span>
    </div>
  );
}

function ToolRow({ tool }: { tool: ToolPolicy }) {
  const perm = permissionBadge[tool.permissionLevel];
  const ToolIcon = guessToolIcon(tool.toolName);

  return (
    <tr className="border-b border-border last:border-b-0">
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-2">
          <ToolIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <div>
            <span className="text-xs font-medium">{tool.toolName}</span>
            {tool.notes && (
              <p className="text-[10px] text-muted-foreground mt-0.5">{tool.notes}</p>
            )}
          </div>
        </div>
      </td>
      <td className="px-3 py-2.5">
        <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium", perm.className)}>
          {perm.label}
        </span>
      </td>
      <td className="px-3 py-2.5">
        <div className="space-y-0.5">
          {tool.usageConditions.map((cond, i) => (
            <span key={i} className="text-[11px] text-muted-foreground flex items-center gap-1">
              <CheckCircle2 className="h-2.5 w-2.5 text-green-600 dark:text-green-400 shrink-0" />
              {cond}
            </span>
          ))}
          {tool.usageConditions.length === 0 && (
            <span className="text-[11px] text-muted-foreground">-</span>
          )}
        </div>
      </td>
      <td className="px-3 py-2.5">
        <div className="space-y-0.5">
          {tool.doNotUseConditions.map((cond, i) => (
            <span key={i} className="text-[11px] text-muted-foreground flex items-center gap-1">
              <XCircle className="h-2.5 w-2.5 text-red-600 dark:text-red-400 shrink-0" />
              {cond}
            </span>
          ))}
          {tool.doNotUseConditions.length === 0 && (
            <span className="text-[11px] text-muted-foreground">-</span>
          )}
        </div>
      </td>
      <td className="px-3 py-2.5">
        <span className="text-[11px] text-muted-foreground">{tool.fallbackBehavior || "-"}</span>
      </td>
      <td className="px-3 py-2.5">
        <div className="space-y-1">
          <MiniBar value={tool.successRate} color="bg-green-500" />
          <MiniBar value={tool.failureRate} color="bg-red-500" />
        </div>
      </td>
      <td className="px-3 py-2.5 text-right">
        <span className="text-[11px] text-muted-foreground font-mono">{tool.usageCount.toLocaleString()}</span>
      </td>
    </tr>
  );
}

export function ToolsPoliciesTab({ cognitiveData }: ToolsPoliciesTabProps) {
  const { toolPolicies } = cognitiveData;

  if (toolPolicies.length === 0) {
    return <p className="text-sm text-muted-foreground">No tool policies configured.</p>;
  }

  return (
    <div className="space-y-4">
      {/* Summary badges */}
      <div className="flex flex-wrap gap-2">
        <Badge variant="outline" className="text-xs gap-1">
          <Wrench className="h-3 w-3" />
          {toolPolicies.length} tools
        </Badge>
        <Badge variant="outline" className="text-xs gap-1 text-green-700 dark:text-green-400">
          {toolPolicies.filter((t) => t.permissionLevel === "full").length} full access
        </Badge>
        <Badge variant="outline" className="text-xs gap-1 text-yellow-700 dark:text-yellow-400">
          {toolPolicies.filter((t) => t.permissionLevel === "restricted").length} restricted
        </Badge>
        {toolPolicies.filter((t) => t.permissionLevel === "none").length > 0 && (
          <Badge variant="outline" className="text-xs gap-1 text-red-700 dark:text-red-400">
            {toolPolicies.filter((t) => t.permissionLevel === "none").length} blocked
          </Badge>
        )}
      </div>

      {/* Tool table */}
      <div className="border border-border rounded-lg overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border bg-accent/20">
              <th className="text-left px-3 py-2 font-medium text-muted-foreground whitespace-nowrap">Tool</th>
              <th className="text-left px-3 py-2 font-medium text-muted-foreground whitespace-nowrap">Permission</th>
              <th className="text-left px-3 py-2 font-medium text-muted-foreground whitespace-nowrap">When to Use</th>
              <th className="text-left px-3 py-2 font-medium text-muted-foreground whitespace-nowrap">When Not to Use</th>
              <th className="text-left px-3 py-2 font-medium text-muted-foreground whitespace-nowrap">Fallback</th>
              <th className="text-left px-3 py-2 font-medium text-muted-foreground whitespace-nowrap">Success / Fail</th>
              <th className="text-right px-3 py-2 font-medium text-muted-foreground whitespace-nowrap">Usage</th>
            </tr>
          </thead>
          <tbody>
            {toolPolicies.map((tool) => (
              <ToolRow key={tool.id} tool={tool} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
