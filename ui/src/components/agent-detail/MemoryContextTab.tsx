import {
  FileText,
  Database,
  Globe,
  Share2,
  Eye,
  Pencil,
  Clock,
  Link2,
  HardDrive,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { relativeTime } from "@/lib/utils";
import type { AgentCognitiveData, MemorySource, MemorySourceType } from "@paperclipai/shared";

interface MemoryContextTabProps {
  cognitiveData: AgentCognitiveData;
}

const sourceTypeConfig: Record<MemorySourceType, { icon: typeof FileText; label: string; className: string }> = {
  file: {
    icon: FileText,
    label: "File",
    className: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",
  },
  database: {
    icon: Database,
    label: "Database",
    className: "bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300",
  },
  api: {
    icon: Globe,
    label: "API",
    className: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/50 dark:text-cyan-300",
  },
  shared_context: {
    icon: Share2,
    label: "Shared",
    className: "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300",
  },
};

function freshnessColor(score: number): string {
  if (score >= 0.9) return "text-green-600 dark:text-green-400";
  if (score >= 0.7) return "text-yellow-600 dark:text-yellow-400";
  if (score >= 0.5) return "text-orange-600 dark:text-orange-400";
  return "text-red-600 dark:text-red-400";
}

function freshnessBg(score: number): string {
  if (score >= 0.9) return "bg-green-500";
  if (score >= 0.7) return "bg-yellow-500";
  if (score >= 0.5) return "bg-orange-500";
  return "bg-red-500";
}

export function MemoryContextTab({ cognitiveData }: MemoryContextTabProps) {
  const { memorySources } = cognitiveData;

  if (memorySources.length === 0) {
    return <p className="text-sm text-muted-foreground">No memory sources configured.</p>;
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex flex-wrap gap-2">
        <Badge variant="outline" className="text-xs gap-1">
          <HardDrive className="h-3 w-3" />
          {memorySources.length} sources
        </Badge>
        {(["file", "database", "api", "shared_context"] as MemorySourceType[]).map((type) => {
          const count = memorySources.filter((s) => s.type === type).length;
          if (count === 0) return null;
          const config = sourceTypeConfig[type];
          const TypeIcon = config.icon;
          return (
            <Badge key={type} variant="outline" className="text-xs gap-1">
              <TypeIcon className="h-3 w-3" />
              {count} {config.label.toLowerCase()}
            </Badge>
          );
        })}
      </div>

      {/* Memory source cards */}
      <div className="space-y-2">
        {memorySources.map((source) => {
          const config = sourceTypeConfig[source.type];
          const TypeIcon = config.icon;

          return (
            <div key={source.id} className="border border-border rounded-lg p-4 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <div className={cn(
                    "flex items-center justify-center h-7 w-7 rounded shrink-0",
                    config.className
                  )}>
                    <TypeIcon className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-sm font-medium truncate block">{source.name}</span>
                    <span className="text-[11px] text-muted-foreground font-mono truncate block">{source.path}</span>
                  </div>
                </div>
                <span className={cn(
                  "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium shrink-0",
                  config.className
                )}>
                  {config.label}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                {/* Permissions */}
                <div className="flex items-center gap-1.5">
                  <Eye className={cn("h-3 w-3", source.readPermission ? "text-green-600 dark:text-green-400" : "text-muted-foreground")} />
                  <span className="text-[11px] text-muted-foreground">
                    {source.readPermission ? "Read" : "No read"}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Pencil className={cn("h-3 w-3", source.writePermission ? "text-blue-600 dark:text-blue-400" : "text-muted-foreground")} />
                  <span className="text-[11px] text-muted-foreground">
                    {source.writePermission ? "Write" : "No write"}
                  </span>
                </div>

                {/* Last refresh */}
                <div className="flex items-center gap-1.5">
                  <Clock className="h-3 w-3 text-muted-foreground" />
                  <span className="text-[11px] text-muted-foreground">
                    {relativeTime(source.lastRefresh)}
                  </span>
                </div>

                {/* Freshness */}
                <div className="flex items-center gap-1.5">
                  <div className="h-1.5 w-12 bg-accent rounded-full overflow-hidden">
                    <div
                      className={cn("h-full rounded-full", freshnessBg(source.freshnessScore))}
                      style={{ width: `${source.freshnessScore * 100}%` }}
                    />
                  </div>
                  <span className={cn("text-[11px] font-mono", freshnessColor(source.freshnessScore))}>
                    {(source.freshnessScore * 100).toFixed(0)}%
                  </span>
                </div>
              </div>

              {/* Dependencies */}
              {source.dependencies.length > 0 && (
                <div className="flex items-center gap-1.5 pt-1">
                  <Link2 className="h-3 w-3 text-muted-foreground shrink-0" />
                  <span className="text-[10px] text-muted-foreground">Depends on:</span>
                  {source.dependencies.map((dep) => (
                    <Badge key={dep} variant="secondary" className="text-[10px]">{dep}</Badge>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
