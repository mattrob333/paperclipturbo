import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useDeveloperMode } from "@/context/DeveloperModeContext";
import { useFileContent } from "@/hooks/useWorkspace";
import { useAgentRuntime, useAgentValidation } from "@/hooks/useRuntime";
import type { ValidationItem } from "@paperclipai/shared";
import { AlertTriangle, CheckCircle2, Info, Loader2, XCircle } from "lucide-react";

function SeverityIcon({ severity }: { severity: ValidationItem["severity"] }) {
  switch (severity) {
    case "error":
      return <XCircle className="h-3.5 w-3.5 text-red-400 shrink-0" />;
    case "warning":
      return <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />;
    case "info":
      return <Info className="h-3.5 w-3.5 text-blue-400 shrink-0" />;
  }
}

function ValidationTab() {
  const { selectedAgent } = useDeveloperMode();
  const { data, isLoading, error } = useAgentValidation(selectedAgent);

  if (!selectedAgent) {
    return (
      <div className="flex items-center justify-center h-32 text-[hsl(220,13%,40%)] text-sm px-4 text-center">
        No agent selected
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32 text-[hsl(220,13%,40%)] text-sm">
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
        Loading validation...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-32 text-red-400/70 text-sm px-4 text-center">
        Failed to load validation data
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-[hsl(220,13%,40%)] text-sm px-4 text-center">
        <CheckCircle2 className="h-4 w-4 text-green-400 mr-2" />
        All checks passed
      </div>
    );
  }

  const errors = data.filter((v) => v.severity === "error");
  const warnings = data.filter((v) => v.severity === "warning");
  const infos = data.filter((v) => v.severity === "info");

  return (
    <div className="flex flex-col gap-2 p-3 text-[12px]">
      <div className="flex items-center gap-2 text-[11px] text-[hsl(220,13%,50%)] px-1">
        {errors.length > 0 && <span className="text-red-400">{errors.length} error{errors.length !== 1 ? "s" : ""}</span>}
        {warnings.length > 0 && <span className="text-amber-400">{warnings.length} warning{warnings.length !== 1 ? "s" : ""}</span>}
        {infos.length > 0 && <span className="text-blue-400">{infos.length} info</span>}
      </div>
      {data.map((item, i) => (
        <div key={i} className="rounded bg-[hsl(220,13%,14%)] p-2.5 flex gap-2">
          <SeverityIcon severity={item.severity} />
          <div className="flex-1 min-w-0">
            <div className="text-[hsl(220,13%,70%)] leading-snug">{item.message}</div>
            {item.suggestedFix && (
              <div className="text-[11px] text-[hsl(220,13%,45%)] mt-1">{item.suggestedFix}</div>
            )}
            {item.affectedFiles.length > 0 && (
              <div className="text-[10px] text-[hsl(220,13%,35%)] mt-1 font-mono truncate">
                {item.affectedFiles.join(", ")}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function RuntimeTab() {
  const { activeFile, selectedAgent } = useDeveloperMode();
  const { data: fileData } = useFileContent(selectedAgent, activeFile);
  const { data: runtime, isLoading, error } = useAgentRuntime(selectedAgent);

  if (!selectedAgent) {
    return (
      <div className="flex items-center justify-center h-32 text-[hsl(220,13%,40%)] text-sm">
        No agent selected
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32 text-[hsl(220,13%,40%)] text-sm">
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
        Loading runtime...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-32 text-red-400/70 text-sm px-4 text-center">
        Failed to load runtime data
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 p-3 text-[12px]">
      {/* Agent Runtime */}
      {runtime && (
        <div className="rounded bg-[hsl(220,13%,14%)] p-3">
          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(220,13%,45%)] mb-2">
            Agent Runtime
          </h4>
          <div className="flex flex-col gap-1.5">
            <Row label="Adapter" value={runtime.adapter} />
            {runtime.model && <Row label="Model" value={runtime.model} />}
            <Row label="Status" value={runtime.environmentStatus} />
            <Row label="Heartbeat" value={runtime.heartbeatEnabled ? `On (${Math.round(runtime.heartbeatInterval / 1000)}s)` : "Off"} />
            {runtime.lastHeartbeatAt && (
              <Row label="Last Beat" value={new Date(runtime.lastHeartbeatAt).toLocaleString()} />
            )}
            <Row label="Sandbox" value={runtime.sandboxMode ? "Enabled" : "Disabled"} />
          </div>
        </div>
      )}

      {/* Session State */}
      {runtime?.sessionState && (
        <div className="rounded bg-[hsl(220,13%,14%)] p-3">
          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(220,13%,45%)] mb-2">
            Session
          </h4>
          <div className="flex flex-col gap-1.5">
            <Row label="Status" value={runtime.sessionState.status} />
            {runtime.sessionState.taskKey && <Row label="Task" value={runtime.sessionState.taskKey} />}
            {runtime.sessionState.startedAt && (
              <Row label="Started" value={new Date(runtime.sessionState.startedAt).toLocaleString()} />
            )}
            {runtime.sessionState.lastError && (
              <Row label="Error" value={runtime.sessionState.lastError} />
            )}
          </div>
        </div>
      )}

      {/* Recent Runs */}
      {runtime && runtime.recentRuns.length > 0 && (
        <div className="rounded bg-[hsl(220,13%,14%)] p-3">
          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(220,13%,45%)] mb-2">
            Recent Runs ({runtime.recentRuns.length})
          </h4>
          <div className="flex flex-col gap-1.5">
            {runtime.recentRuns.map((run) => (
              <div key={run.id} className="flex items-center justify-between gap-2 text-[11px]">
                <span className={cn(
                  "shrink-0",
                  run.status === "completed" ? "text-green-400" :
                  run.status === "failed" ? "text-red-400" :
                  run.status === "running" ? "text-blue-400" :
                  "text-[hsl(220,13%,45%)]"
                )}>
                  {run.status}
                </span>
                <span className="text-[hsl(220,13%,40%)] truncate text-right">
                  {run.invocationSource}
                  {run.startedAt && ` - ${new Date(run.startedAt).toLocaleTimeString()}`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* File Details (when a file is selected) */}
      {activeFile && (
        <div className="rounded bg-[hsl(220,13%,14%)] p-3">
          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(220,13%,45%)] mb-2">
            File Details
          </h4>
          <div className="flex flex-col gap-1.5">
            <Row label="Name" value={activeFile.split("/").pop() ?? ""} />
            <Row label="Path" value={activeFile} />
            {fileData && (
              <>
                <Row label="Size" value={`${(fileData.size / 1024).toFixed(1)} KB`} />
                <Row label="Type" value={fileData.fileType} />
                <Row label="Modified" value={new Date(fileData.modifiedAt).toLocaleString()} />
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ContextTab() {
  const { activeFile, workspaceRoot, selectedAgent } = useDeveloperMode();
  const fileName = activeFile?.split("/").pop() ?? null;
  const { data: runtime } = useAgentRuntime(selectedAgent);

  if (!selectedAgent) {
    return (
      <div className="flex items-center justify-center h-32 text-[hsl(220,13%,40%)] text-sm">
        No agent selected
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 p-3 text-[12px]">
      {/* Agent Info */}
      {runtime && (
        <div className="rounded bg-[hsl(220,13%,14%)] p-3">
          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(220,13%,45%)] mb-2">
            Agent
          </h4>
          <div className="flex flex-col gap-1.5">
            <Row label="Adapter" value={runtime.adapter} />
            <Row label="Access" value={runtime.accessProfile} />
            {runtime.modelTier && <Row label="Tier" value={runtime.modelTier} />}
          </div>
        </div>
      )}

      {/* Workspace */}
      <div className="rounded bg-[hsl(220,13%,14%)] p-3">
        <h4 className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(220,13%,45%)] mb-2">
          Workspace
        </h4>
        <div className="flex flex-col gap-1.5">
          {workspaceRoot ? (
            <Row label="Root" value={workspaceRoot} />
          ) : (
            <div className="text-[hsl(220,13%,40%)] text-[11px]">No workspace configured</div>
          )}
        </div>
      </div>

      {/* Active File */}
      {activeFile && (
        <div className="rounded bg-[hsl(220,13%,14%)] p-3">
          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(220,13%,45%)] mb-2">
            File
          </h4>
          <div className="flex flex-col gap-1.5">
            <Row label="File" value={fileName ?? "None"} />
            <Row label="Path" value={activeFile} />
          </div>
        </div>
      )}

      {/* Cron Jobs */}
      {runtime && runtime.cronJobs.length > 0 && (
        <div className="rounded bg-[hsl(220,13%,14%)] p-3">
          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(220,13%,45%)] mb-2">
            Cron Jobs ({runtime.cronJobs.length})
          </h4>
          <div className="flex flex-col gap-1.5">
            {runtime.cronJobs.map((job, i) => (
              <div key={i} className="flex items-center justify-between gap-2 text-[11px]">
                <span className="text-[hsl(220,13%,70%)] truncate">{job.name}</span>
                <span className={cn(
                  "shrink-0 font-mono",
                  job.enabled ? "text-green-400" : "text-[hsl(220,13%,35%)]"
                )}>
                  {job.schedule}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value, children }: { label: string; value: string; children?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[hsl(220,13%,45%)] shrink-0">{label}</span>
      <span className="text-[hsl(220,13%,75%)] font-mono flex items-center truncate text-right">
        {children}
        {value}
      </span>
    </div>
  );
}

export function ContextPanel() {
  const { inspectorTab, setInspectorTab } = useDeveloperMode();

  const tabs = [
    { value: "validation" as const, label: "Validation" },
    { value: "runtime" as const, label: "Runtime" },
    { value: "context" as const, label: "Context" },
  ];

  return (
    <div className="flex h-full flex-col bg-[hsl(220,13%,12%)]">
      <div className="flex items-center border-b border-[hsl(220,13%,20%)]">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setInspectorTab(tab.value)}
            className={cn(
              "flex-1 py-2 text-[11px] font-medium uppercase tracking-wider transition-colors",
              inspectorTab === tab.value
                ? "text-white border-b-2 border-[hsl(210,70%,55%)]"
                : "text-[hsl(220,13%,45%)] hover:text-[hsl(220,13%,65%)]",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-auto-hide">
        {inspectorTab === "validation" && <ValidationTab />}
        {inspectorTab === "runtime" && <RuntimeTab />}
        {inspectorTab === "context" && <ContextTab />}
      </div>
    </div>
  );
}
