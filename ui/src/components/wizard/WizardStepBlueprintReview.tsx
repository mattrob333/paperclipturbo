import { useQuery } from "@tanstack/react-query";
import { FileText, Users, GitBranch } from "lucide-react";
import { instancesApi } from "../../api/instances";
import { queryKeys } from "../../lib/queryKeys";

interface WizardStepBlueprintReviewProps {
  companySlug: string;
}

export function WizardStepBlueprintReview({
  companySlug,
}: WizardStepBlueprintReviewProps) {
  const { data: manifest, isLoading: manifestLoading } = useQuery({
    queryKey: queryKeys.instances.detail(companySlug),
    queryFn: () => instancesApi.get(companySlug),
    enabled: !!companySlug,
  });

  const { data: blueprintData, isLoading: blueprintLoading } = useQuery({
    queryKey: queryKeys.instances.blueprint(companySlug),
    queryFn: () => instancesApi.blueprint(companySlug),
    enabled: !!companySlug,
  });

  const isLoading = manifestLoading || blueprintLoading;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 mb-1">
        <div className="bg-muted/50 p-2">
          <FileText className="h-5 w-5 text-muted-foreground" />
        </div>
        <div>
          <h3 className="font-medium">Review blueprint</h3>
          <p className="text-xs text-muted-foreground">
            Review the compiled blueprint before provisioning.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <div className="h-8 bg-muted/50 rounded animate-pulse" />
          <div className="h-32 bg-muted/50 rounded animate-pulse" />
        </div>
      ) : (
        <>
          {manifest && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-md border border-border px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Company
                  </p>
                  <p className="text-sm font-medium mt-0.5">{manifest.companyName}</p>
                </div>
                <div className="rounded-md border border-border px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Source of Truth
                  </p>
                  <p className="text-sm font-medium mt-0.5 capitalize">
                    {manifest.sourceOfTruth.replace("_", " ")}
                  </p>
                </div>
              </div>

              {manifest.openclaw.agents.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Users className="h-3.5 w-3.5 text-muted-foreground" />
                    <p className="text-xs font-medium">
                      Roles ({manifest.openclaw.agents.length})
                    </p>
                  </div>
                  <div className="grid gap-1.5">
                    {manifest.openclaw.agents.map((agent) => (
                      <div
                        key={agent.roleId}
                        className="flex items-center gap-2 rounded-md border border-border px-3 py-2"
                      >
                        <GitBranch className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium capitalize">
                            {agent.roleId.replace(/_/g, " ")}
                          </p>
                          <p className="text-[11px] text-muted-foreground font-mono truncate">
                            {agent.folderName}/
                          </p>
                        </div>
                        <span className="text-[10px] text-muted-foreground">
                          {agent.files.length} files
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {blueprintData?.yaml && (
            <div>
              <p className="text-xs font-medium mb-1.5">Blueprint YAML</p>
              <pre className="rounded-md border border-border bg-muted/30 p-3 text-xs font-mono overflow-x-auto max-h-64 overflow-y-auto whitespace-pre-wrap">
                {blueprintData.yaml}
              </pre>
            </div>
          )}
        </>
      )}
    </div>
  );
}
