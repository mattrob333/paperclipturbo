import type { InstanceSummary } from "@paperclipai/shared";
import { Building2 } from "lucide-react";

interface WizardStepCompanyCreateProps {
  instances: InstanceSummary[];
  selectedSlug: string;
  onSelectSlug: (slug: string) => void;
}

export function WizardStepCompanyCreate({
  instances,
  selectedSlug,
  onSelectSlug,
}: WizardStepCompanyCreateProps) {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 mb-1">
        <div className="bg-muted/50 p-2">
          <Building2 className="h-5 w-5 text-muted-foreground" />
        </div>
        <div>
          <h3 className="font-medium">Select a compiled company</h3>
          <p className="text-xs text-muted-foreground">
            Choose from companies that have been compiled by AgentOrgCompiler.
          </p>
        </div>
      </div>

      {instances.length === 0 ? (
        <div className="rounded-md border border-border bg-muted/20 px-4 py-6 text-center">
          <p className="text-sm text-muted-foreground">
            No compiled companies found.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Run the AgentOrgCompiler to generate a company first.
          </p>
        </div>
      ) : (
        <div>
          <label className="text-xs text-muted-foreground mb-2 block">
            Compiled companies
          </label>
          <div className="grid gap-2">
            {instances.map((instance) => (
              <button
                key={instance.companyId}
                type="button"
                className={`flex items-center gap-3 rounded-md border p-3 text-left transition-colors ${
                  selectedSlug === instance.companyId
                    ? "border-foreground bg-accent"
                    : "border-border hover:bg-accent/50"
                }`}
                onClick={() => onSelectSlug(instance.companyId)}
              >
                <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {instance.companyName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {instance.companyId}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <InstanceStatusDot status={instance.openclawStatus} label="OpenClaw" />
                  <InstanceStatusDot status={instance.paperclipStatus} label="Paperclip" />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function InstanceStatusDot({
  status,
  label,
}: {
  status: string;
  label: string;
}) {
  const dotClass =
    status === "connected" || status === "validated" || status === "synced"
      ? "bg-green-400"
      : status === "provisioned" || status === "imported"
        ? "bg-yellow-400"
        : status === "error" || status === "drift_detected"
          ? "bg-red-400"
          : "bg-neutral-400";

  return (
    <div className="flex items-center gap-1">
      <span className={`h-2 w-2 rounded-full ${dotClass}`} />
      <span className="text-[10px] text-muted-foreground">{label}</span>
    </div>
  );
}
