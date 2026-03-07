import {
  Cpu,
  Timer,
  Clock,
  Shield,
  Box,
  Layers,
  Package,
  Activity,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { AgentCognitiveData, ModelTier } from "@paperclipai/shared";

interface RuntimeTabProps {
  cognitiveData: AgentCognitiveData;
}

const tierBadge: Record<ModelTier, string> = {
  frontier: "bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300",
  standard: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",
  fast: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/50 dark:text-cyan-300",
  mini: "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300",
};

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border last:border-b-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1.5">{children}</div>
    </div>
  );
}

export function RuntimeTab({ cognitiveData }: RuntimeTabProps) {
  const { runtimeProfile } = cognitiveData;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Adapter & Model */}
        <div className="border border-border rounded-lg p-4 space-y-1">
          <h3 className="text-sm font-medium flex items-center gap-2 mb-3">
            <Cpu className="h-3.5 w-3.5 text-muted-foreground" />
            Model & Adapter
          </h3>
          <InfoRow label="Adapter">
            <Badge variant="outline" className="text-[11px] font-mono">{runtimeProfile.adapter}</Badge>
          </InfoRow>
          <InfoRow label="Model">
            <span className="text-xs font-mono">{runtimeProfile.modelName}</span>
          </InfoRow>
          <InfoRow label="Tier">
            <span className={cn(
              "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
              tierBadge[runtimeProfile.modelTier]
            )}>
              {runtimeProfile.modelTier}
            </span>
          </InfoRow>
        </div>

        {/* Heartbeat */}
        <div className="border border-border rounded-lg p-4 space-y-1">
          <h3 className="text-sm font-medium flex items-center gap-2 mb-3">
            <Activity className="h-3.5 w-3.5 text-muted-foreground" />
            Heartbeat
          </h3>
          <InfoRow label="Mode">
            <Badge variant="outline" className="text-[11px]">{runtimeProfile.heartbeatMode}</Badge>
          </InfoRow>
          <InfoRow label="Interval">
            <span className="text-xs font-mono">
              {runtimeProfile.heartbeatInterval >= 60
                ? `${Math.round(runtimeProfile.heartbeatInterval / 60)} min`
                : `${runtimeProfile.heartbeatInterval}s`}
            </span>
          </InfoRow>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Cron Jobs */}
        <div className="border border-border rounded-lg p-4 space-y-3">
          <h3 className="text-sm font-medium flex items-center gap-2">
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            Cron Jobs
          </h3>
          {runtimeProfile.cronJobs.length === 0 ? (
            <p className="text-xs text-muted-foreground">No scheduled jobs.</p>
          ) : (
            <div className="space-y-1.5">
              {runtimeProfile.cronJobs.map((job) => (
                <div key={job} className="flex items-center gap-2">
                  <Timer className="h-3 w-3 text-muted-foreground shrink-0" />
                  <span className="text-xs font-mono">{job}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Environment & Access */}
        <div className="border border-border rounded-lg p-4 space-y-1">
          <h3 className="text-sm font-medium flex items-center gap-2 mb-3">
            <Shield className="h-3.5 w-3.5 text-muted-foreground" />
            Environment & Access
          </h3>
          <InfoRow label="Sandbox Mode">
            {runtimeProfile.sandboxMode ? (
              <Badge variant="default" className="text-[10px]">Enabled</Badge>
            ) : (
              <Badge variant="outline" className="text-[10px]">Disabled</Badge>
            )}
          </InfoRow>
          <InfoRow label="Access Profile">
            <Badge variant="outline" className="text-[11px] font-mono">{runtimeProfile.accessProfile}</Badge>
          </InfoRow>
          <InfoRow label="Environment">
            <span className={cn(
              "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
              runtimeProfile.environmentStatus === "active"
                ? "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300"
                : runtimeProfile.environmentStatus === "degraded"
                ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300"
                : "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300"
            )}>
              {runtimeProfile.environmentStatus}
            </span>
          </InfoRow>
          <InfoRow label="Exporter Version">
            <span className="text-xs font-mono">v{runtimeProfile.exporterVersion}</span>
          </InfoRow>
        </div>
      </div>
    </div>
  );
}
