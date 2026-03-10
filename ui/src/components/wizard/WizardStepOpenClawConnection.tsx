import { Link2, FolderOpen } from "lucide-react";
import type { ProvisionMode } from "./WizardStepProvisionRuntime";

interface WizardStepOpenClawConnectionProps {
  mode: ProvisionMode;
  workspacePath: string;
  onWorkspacePathChange: (path: string) => void;
  instanceName: string;
  onInstanceNameChange: (name: string) => void;
  environment: "development" | "staging" | "production";
  onEnvironmentChange: (env: "development" | "staging" | "production") => void;
  heartbeatMode: "on-demand" | "scheduled" | "continuous";
  onHeartbeatModeChange: (mode: "on-demand" | "scheduled" | "continuous") => void;
  fileSyncMode: "manual" | "auto" | "watch";
  onFileSyncModeChange: (mode: "manual" | "auto" | "watch") => void;
}

export function WizardStepOpenClawConnection({
  mode,
  workspacePath,
  onWorkspacePathChange,
  instanceName,
  onInstanceNameChange,
  environment,
  onEnvironmentChange,
  heartbeatMode,
  onHeartbeatModeChange,
  fileSyncMode,
  onFileSyncModeChange,
}: WizardStepOpenClawConnectionProps) {
  if (mode === "export_only") {
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-3 mb-1">
          <div className="bg-muted/50 p-2">
            <Link2 className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <h3 className="font-medium">Export only mode</h3>
            <p className="text-xs text-muted-foreground">
              No OpenClaw workspace configuration needed. The company will be
              imported directly into Paperclip.
            </p>
          </div>
        </div>
        <div className="rounded-md border border-border bg-muted/20 px-4 py-4 text-sm text-muted-foreground">
          OpenClaw provisioning is skipped. You can connect an OpenClaw instance
          later from the instance detail page.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 mb-1">
        <div className="bg-muted/50 p-2">
          <Link2 className="h-5 w-5 text-muted-foreground" />
        </div>
        <div>
          <h3 className="font-medium">
            {mode === "new"
              ? "Configure new workspace"
              : "Connect existing workspace"}
          </h3>
          <p className="text-xs text-muted-foreground">
            {mode === "new"
              ? "Set up the OpenClaw workspace where agent files will be provisioned."
              : "Point to the existing OpenClaw workspace to validate and connect."}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">
            Workspace path
          </label>
          <div className="flex items-center gap-2 rounded-md border border-border px-2.5 py-1.5">
            <FolderOpen className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <input
              className="w-full bg-transparent outline-none text-sm font-mono placeholder:text-muted-foreground/50"
              placeholder="/path/to/openclaw/workspace"
              value={workspacePath}
              onChange={(e) => onWorkspacePathChange(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="text-xs text-muted-foreground mb-1 block">
            Instance name (optional)
          </label>
          <input
            className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50"
            placeholder="e.g. dev-local"
            value={instanceName}
            onChange={(e) => onInstanceNameChange(e.target.value)}
          />
        </div>

        <div>
          <label className="text-xs text-muted-foreground mb-1 block">
            Environment
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(["development", "staging", "production"] as const).map((env) => (
              <button
                key={env}
                type="button"
                className={`rounded-md border px-3 py-2 text-xs font-medium transition-colors capitalize ${
                  environment === env
                    ? "border-foreground bg-accent"
                    : "border-border hover:bg-accent/50"
                }`}
                onClick={() => onEnvironmentChange(env)}
              >
                {env}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs text-muted-foreground mb-1 block">
            Heartbeat mode
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(["on-demand", "scheduled", "continuous"] as const).map((hm) => (
              <button
                key={hm}
                type="button"
                className={`rounded-md border px-3 py-2 text-xs font-medium transition-colors capitalize ${
                  heartbeatMode === hm
                    ? "border-foreground bg-accent"
                    : "border-border hover:bg-accent/50"
                }`}
                onClick={() => onHeartbeatModeChange(hm)}
              >
                {hm.replace("-", " ")}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs text-muted-foreground mb-1 block">
            File sync mode
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(["manual", "auto", "watch"] as const).map((fsm) => (
              <button
                key={fsm}
                type="button"
                className={`rounded-md border px-3 py-2 text-xs font-medium transition-colors capitalize ${
                  fileSyncMode === fsm
                    ? "border-foreground bg-accent"
                    : "border-border hover:bg-accent/50"
                }`}
                onClick={() => onFileSyncModeChange(fsm)}
              >
                {fsm}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
