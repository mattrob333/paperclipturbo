import { useMutation } from "@tanstack/react-query";
import {
  Rocket,
  Check,
  ExternalLink,
  Loader2,
  Network,
  Brain,
  Code2,
  LayoutDashboard,
} from "lucide-react";
import type { InstanceManifest } from "@paperclipai/shared";
import { instancesApi } from "../../api/instances";
import { Button } from "@/components/ui/button";

interface WizardStepLaunchProps {
  companySlug: string;
  manifest: InstanceManifest | null;
  imported: boolean;
  onImported: () => void;
  onNavigate: (path: string) => void;
}

export function WizardStepLaunch({
  companySlug,
  manifest,
  imported,
  onImported,
  onNavigate,
}: WizardStepLaunchProps) {
  const importMutation = useMutation({
    mutationFn: () => instancesApi.import(companySlug),
    onSuccess: () => onImported(),
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 mb-1">
        <div className="bg-muted/50 p-2">
          <Rocket className="h-5 w-5 text-muted-foreground" />
        </div>
        <div>
          <h3 className="font-medium">
            {imported ? "Instance ready" : "Import and launch"}
          </h3>
          <p className="text-xs text-muted-foreground">
            {imported
              ? "Your instance is set up and imported into Paperclip."
              : "Import the company into Paperclip to start managing it."}
          </p>
        </div>
      </div>

      {!imported && (
        <div className="flex flex-col items-center gap-3 py-4">
          <p className="text-sm text-muted-foreground text-center max-w-sm">
            This will import the compiled company blueprint and all agents into
            Paperclip for monitoring and management.
          </p>
          <Button
            onClick={() => importMutation.mutate()}
            disabled={importMutation.isPending}
          >
            {importMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            ) : (
              <Rocket className="h-3.5 w-3.5 mr-1.5" />
            )}
            {importMutation.isPending ? "Importing..." : "Import into Paperclip"}
          </Button>
          {importMutation.isError && (
            <p className="text-xs text-destructive">
              {importMutation.error instanceof Error
                ? importMutation.error.message
                : "Import failed"}
            </p>
          )}
        </div>
      )}

      {imported && (
        <div className="space-y-4">
          {/* Summary checklist */}
          <div className="border border-border divide-y divide-border rounded-md">
            <SummaryRow
              label={manifest?.companyName ?? companySlug}
              subtitle="Company imported"
              done
            />
            <SummaryRow
              label={`${manifest?.openclaw.agents.length ?? 0} agents`}
              subtitle="Roles provisioned"
              done
            />
            <SummaryRow
              label={manifest?.openclaw.status === "not_provisioned" ? "Export only" : "Connected"}
              subtitle="OpenClaw status"
              done
            />
            <SummaryRow
              label="Imported"
              subtitle="Paperclip status"
              done
            />
          </div>

          {/* Quick navigation links */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">
              Quick links
            </p>
            <div className="grid grid-cols-2 gap-2">
              <QuickLink
                icon={LayoutDashboard}
                label="Dashboard"
                onClick={() => onNavigate("/dashboard")}
              />
              <QuickLink
                icon={Network}
                label="Org Chart"
                onClick={() => onNavigate("/org")}
              />
              <QuickLink
                icon={Brain}
                label="Cognitive Blueprint"
                onClick={() => onNavigate("/cognitive-blueprint")}
              />
              <QuickLink
                icon={Code2}
                label="Developer Mode"
                onClick={() => onNavigate("/developer-mode")}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryRow({
  label,
  subtitle,
  done,
}: {
  label: string;
  subtitle: string;
  done: boolean;
}) {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5">
      {done ? (
        <Check className="h-4 w-4 text-green-500 shrink-0" />
      ) : (
        <div className="h-4 w-4 rounded-full border border-border shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{label}</p>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );
}

function QuickLink({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof ExternalLink;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
      <ExternalLink className="h-2.5 w-2.5 ml-auto" />
    </button>
  );
}
