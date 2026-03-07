import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  GitCompare,
  AlertOctagon,
  Lightbulb,
  Shield,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { relativeTime } from "@/lib/utils";
import type { AgentCognitiveData } from "@paperclipai/shared";

interface AuditDriftTabProps {
  cognitiveData: AgentCognitiveData;
}

function driftColor(score: number): string {
  if (score <= 0.05) return "text-green-600 dark:text-green-400";
  if (score <= 0.15) return "text-yellow-600 dark:text-yellow-400";
  if (score <= 0.3) return "text-orange-600 dark:text-orange-400";
  return "text-red-600 dark:text-red-400";
}

function driftBg(score: number): string {
  if (score <= 0.05) return "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300";
  if (score <= 0.15) return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300";
  if (score <= 0.3) return "bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300";
  return "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300";
}

function driftSeverity(score: number): string {
  if (score <= 0.05) return "Aligned";
  if (score <= 0.15) return "Minor Drift";
  if (score <= 0.3) return "Moderate Drift";
  return "Significant Drift";
}

function FieldList({ title, icon: Icon, fields, color }: {
  title: string;
  icon: typeof AlertTriangle;
  fields: string[];
  color: string;
}) {
  if (fields.length === 0) return null;
  return (
    <div className="space-y-2">
      <h4 className="text-xs font-medium flex items-center gap-1.5">
        <Icon className={cn("h-3 w-3", color)} />
        {title}
        <Badge variant="outline" className="text-[10px]">{fields.length}</Badge>
      </h4>
      <div className="space-y-1">
        {fields.map((field, i) => (
          <div key={i} className="flex items-center gap-2 px-2 py-1 bg-accent/30 rounded text-xs">
            <span className="font-mono text-muted-foreground">{field}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AuditDriftTab({ cognitiveData }: AuditDriftTabProps) {
  const { auditDriftReport, cognitiveHealth } = cognitiveData;
  const report = auditDriftReport;

  return (
    <div className="space-y-4">
      {/* Drift Score Hero */}
      <div className="border border-border rounded-lg p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              "flex items-center justify-center h-12 w-12 rounded-lg",
              driftBg(report.driftScore)
            )}>
              <span className="text-lg font-bold">{(report.driftScore * 100).toFixed(0)}%</span>
            </div>
            <div>
              <h3 className="text-sm font-medium">Drift Score</h3>
              <span className={cn("text-xs", driftColor(report.driftScore))}>
                {driftSeverity(report.driftScore)}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            {relativeTime(report.lastAuditedAt)}
          </div>
        </div>

        {/* Version comparison */}
        <div className="flex items-center gap-3">
          <GitCompare className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">Blueprint:</span>
            <Badge variant="outline" className="text-[11px] font-mono">{report.blueprintVersion}</Badge>
            <span className="text-muted-foreground">vs Live:</span>
            <Badge
              variant="outline"
              className={cn(
                "text-[11px] font-mono",
                report.blueprintVersion !== report.liveVersion && "border-yellow-500 text-yellow-700 dark:text-yellow-400"
              )}
            >
              {report.liveVersion}
            </Badge>
            {report.blueprintVersion === report.liveVersion && (
              <CheckCircle2 className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
            )}
            {report.blueprintVersion !== report.liveVersion && (
              <AlertTriangle className="h-3.5 w-3.5 text-yellow-600 dark:text-yellow-400" />
            )}
          </div>
        </div>
      </div>

      {/* Cognitive Health Scores */}
      <div className="border border-border rounded-lg p-4 space-y-3">
        <h3 className="text-sm font-medium flex items-center gap-2">
          <Shield className="h-3.5 w-3.5 text-muted-foreground" />
          Cognitive Health
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: "Alignment", value: cognitiveHealth.alignmentScore },
            { label: "Drift", value: 1 - cognitiveHealth.driftScore },
            { label: "Completeness", value: cognitiveHealth.completenessScore },
            { label: "Tool Coverage", value: cognitiveHealth.toolPolicyCoverage },
            { label: "Delegation", value: cognitiveHealth.delegationCoverage },
          ].map(({ label, value }) => (
            <div key={label} className="text-center space-y-1">
              <div className="h-1.5 w-full bg-accent rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full",
                    value >= 0.9 ? "bg-green-500"
                      : value >= 0.7 ? "bg-yellow-500"
                      : "bg-red-500"
                  )}
                  style={{ width: `${value * 100}%` }}
                />
              </div>
              <span className={cn(
                "text-sm font-bold",
                value >= 0.9 ? "text-green-600 dark:text-green-400"
                  : value >= 0.7 ? "text-yellow-600 dark:text-yellow-400"
                  : "text-red-600 dark:text-red-400"
              )}>
                {(value * 100).toFixed(0)}%
              </span>
              <span className="text-[10px] text-muted-foreground block">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Fields lists */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="border border-border rounded-lg p-4">
          <FieldList
            title="Missing Fields"
            icon={XCircle}
            fields={report.missingFields}
            color="text-red-600 dark:text-red-400"
          />
          {report.missingFields.length === 0 && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <CheckCircle2 className="h-3 w-3 text-green-600 dark:text-green-400" />
              No missing fields
            </div>
          )}
        </div>
        <div className="border border-border rounded-lg p-4">
          <FieldList
            title="Mismatched Fields"
            icon={AlertOctagon}
            fields={report.mismatchedFields}
            color="text-orange-600 dark:text-orange-400"
          />
          {report.mismatchedFields.length === 0 && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <CheckCircle2 className="h-3 w-3 text-green-600 dark:text-green-400" />
              No mismatched fields
            </div>
          )}
        </div>
        <div className="border border-border rounded-lg p-4">
          <FieldList
            title="Stale Fields"
            icon={Clock}
            fields={report.staleFields}
            color="text-yellow-600 dark:text-yellow-400"
          />
          {report.staleFields.length === 0 && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <CheckCircle2 className="h-3 w-3 text-green-600 dark:text-green-400" />
              No stale fields
            </div>
          )}
        </div>
      </div>

      {/* Steward Recommendations */}
      {report.stewardRecommendations.length > 0 && (
        <div className="border border-border rounded-lg p-4 space-y-3">
          <h3 className="text-sm font-medium flex items-center gap-2">
            <Lightbulb className="h-3.5 w-3.5 text-yellow-600 dark:text-yellow-400" />
            Steward Recommendations
          </h3>
          <div className="space-y-2">
            {report.stewardRecommendations.map((rec, i) => (
              <div key={i} className="flex items-start gap-2 px-3 py-2 bg-accent/30 rounded-lg">
                <Lightbulb className="h-3.5 w-3.5 text-yellow-600 dark:text-yellow-400 mt-0.5 shrink-0" />
                <span className="text-xs text-muted-foreground">{rec}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
