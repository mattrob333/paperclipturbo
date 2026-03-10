import { Server, FolderOpen, Download } from "lucide-react";

export type ProvisionMode = "new" | "existing" | "export_only";

interface WizardStepProvisionRuntimeProps {
  mode: ProvisionMode;
  onModeChange: (mode: ProvisionMode) => void;
}

const options: Array<{
  value: ProvisionMode;
  label: string;
  description: string;
  icon: typeof Server;
}> = [
  {
    value: "new",
    label: "Create new workspace",
    description:
      "Provision a new OpenClaw workspace and copy generated files into it.",
    icon: Server,
  },
  {
    value: "existing",
    label: "Connect existing workspace",
    description:
      "Point to an existing OpenClaw workspace that already has agent files.",
    icon: FolderOpen,
  },
  {
    value: "export_only",
    label: "Export only",
    description:
      "Skip OpenClaw provisioning. Only import into Paperclip for monitoring.",
    icon: Download,
  },
];

export function WizardStepProvisionRuntime({
  mode,
  onModeChange,
}: WizardStepProvisionRuntimeProps) {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 mb-1">
        <div className="bg-muted/50 p-2">
          <Server className="h-5 w-5 text-muted-foreground" />
        </div>
        <div>
          <h3 className="font-medium">Provision runtime</h3>
          <p className="text-xs text-muted-foreground">
            Choose how to set up the OpenClaw runtime workspace.
          </p>
        </div>
      </div>

      <div className="grid gap-2">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            className={`flex items-start gap-3 rounded-md border p-4 text-left transition-colors ${
              mode === opt.value
                ? "border-foreground bg-accent"
                : "border-border hover:bg-accent/50"
            }`}
            onClick={() => onModeChange(opt.value)}
          >
            <opt.icon className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium">{opt.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {opt.description}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
