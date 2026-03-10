import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Server, RefreshCw } from "lucide-react";
import { useNavigate } from "@/lib/router";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { instancesApi } from "../api/instances";
import { queryKeys } from "../lib/queryKeys";
import { cn } from "../lib/utils";
import { EmptyState } from "../components/EmptyState";
import { PageSkeleton } from "../components/PageSkeleton";
import { Button } from "@/components/ui/button";

const openclawStatusLabel: Record<string, string> = {
  not_provisioned: "Not Provisioned",
  provisioned: "Provisioned",
  connected: "Connected",
  validated: "Validated",
  error: "Error",
};

const paperclipStatusLabel: Record<string, string> = {
  not_imported: "Not Imported",
  imported: "Imported",
  synced: "Synced",
  drift_detected: "Drift Detected",
};

const openclawStatusColor: Record<string, string> = {
  not_provisioned: "bg-neutral-100 text-neutral-700 dark:bg-neutral-900/50 dark:text-neutral-300",
  provisioned: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300",
  connected: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",
  validated: "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300",
  error: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300",
};

const paperclipStatusColor: Record<string, string> = {
  not_imported: "bg-neutral-100 text-neutral-700 dark:bg-neutral-900/50 dark:text-neutral-300",
  imported: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",
  synced: "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300",
  drift_detected: "bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300",
};

export function Instances() {
  const navigate = useNavigate();
  const { setBreadcrumbs } = useBreadcrumbs();

  const {
    data: instances,
    isLoading,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: queryKeys.instances.all,
    queryFn: () => instancesApi.list(),
  });

  useEffect(() => {
    setBreadcrumbs([{ label: "Instances" }]);
  }, [setBreadcrumbs]);

  if (isLoading) {
    return <PageSkeleton variant="list" />;
  }

  if (!instances || instances.length === 0) {
    return (
      <EmptyState
        icon={Server}
        message="No compiled instances found. Run the AgentOrgCompiler to generate company blueprints."
        action="Setup Wizard"
        onAction={() => navigate("/instances/wizard")}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw
              className={cn(
                "h-3.5 w-3.5 mr-1.5",
                isFetching && "animate-spin",
              )}
            />
            Refresh
          </Button>
        </div>
        <Button size="sm" onClick={() => navigate("/instances/wizard")}>
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Setup Wizard
        </Button>
      </div>

      <div className="grid gap-4">
        {instances.map((instance) => (
          <button
            key={instance.companyId}
            type="button"
            className="group text-left bg-card border border-border rounded-lg p-5 transition-colors cursor-pointer hover:border-muted-foreground/30"
            onClick={() =>
              navigate(`/instances/wizard/${encodeURIComponent(instance.companyId)}`)
            }
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Server className="h-4 w-4 text-muted-foreground shrink-0" />
                  <h3 className="font-semibold text-base truncate">
                    {instance.companyName}
                  </h3>
                </div>
                <p className="text-xs text-muted-foreground mt-1 font-mono">
                  {instance.companyId}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 mt-4 flex-wrap">
              <StatusPill
                label={`OpenClaw: ${openclawStatusLabel[instance.openclawStatus] ?? instance.openclawStatus}`}
                className={openclawStatusColor[instance.openclawStatus] ?? "bg-muted text-muted-foreground"}
              />
              <StatusPill
                label={`Paperclip: ${paperclipStatusLabel[instance.paperclipStatus] ?? instance.paperclipStatus}`}
                className={paperclipStatusColor[instance.paperclipStatus] ?? "bg-muted text-muted-foreground"}
              />
              {instance.lastSync && (
                <span className="text-xs text-muted-foreground ml-auto">
                  Last sync: {new Date(instance.lastSync).toLocaleDateString()}
                </span>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function StatusPill({
  label,
  className,
}: {
  label: string;
  className: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        className,
      )}
    >
      {label}
    </span>
  );
}
