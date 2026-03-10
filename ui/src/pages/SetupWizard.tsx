import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Loader2, Sparkles, X } from "lucide-react";
import { useNavigate, useParams } from "@/lib/router";
import type { ConnectionValidation, InstanceManifest } from "@paperclipai/shared";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { instancesApi } from "../api/instances";
import { queryKeys } from "../lib/queryKeys";
import { cn } from "../lib/utils";
import { Button } from "@/components/ui/button";
import { WizardStepCompanyCreate } from "../components/wizard/WizardStepCompanyCreate";
import { WizardStepBlueprintReview } from "../components/wizard/WizardStepBlueprintReview";
import {
  WizardStepProvisionRuntime,
  type ProvisionMode,
} from "../components/wizard/WizardStepProvisionRuntime";
import { WizardStepOpenClawConnection } from "../components/wizard/WizardStepOpenClawConnection";
import { WizardStepValidate } from "../components/wizard/WizardStepValidate";
import { WizardStepLaunch } from "../components/wizard/WizardStepLaunch";

type Step = 1 | 2 | 3 | 4 | 5 | 6;

const STEP_LABELS: Record<Step, string> = {
  1: "Select Company",
  2: "Review Blueprint",
  3: "Provision",
  4: "Connection",
  5: "Validate",
  6: "Launch",
};

export function SetupWizard() {
  const { companySlug: routeSlug } = useParams<{ companySlug?: string }>();
  const navigate = useNavigate();
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<Step>(routeSlug ? 2 : 1);
  const [selectedSlug, setSelectedSlug] = useState(routeSlug ?? "");

  // Step 3: Provision mode
  const [provisionMode, setProvisionMode] = useState<ProvisionMode>("new");

  // Step 4: OpenClaw connection settings
  const [workspacePath, setWorkspacePath] = useState("");
  const [instanceName, setInstanceName] = useState("");
  const [environment, setEnvironment] = useState<
    "development" | "staging" | "production"
  >("development");
  const [heartbeatMode, setHeartbeatMode] = useState<
    "on-demand" | "scheduled" | "continuous"
  >("on-demand");
  const [fileSyncMode, setFileSyncMode] = useState<
    "manual" | "auto" | "watch"
  >("manual");

  // Step 5: Validation
  const [validation, setValidation] = useState<ConnectionValidation | null>(
    null,
  );

  // Step 6: Import state
  const [imported, setImported] = useState(false);
  const [manifest, setManifest] = useState<InstanceManifest | null>(null);

  // Fetch instances for step 1
  const { data: instances = [], isLoading: instancesLoading } = useQuery({
    queryKey: queryKeys.instances.all,
    queryFn: () => instancesApi.list(),
  });

  // Fetch manifest for selected company
  const { data: fetchedManifest } = useQuery({
    queryKey: queryKeys.instances.detail(selectedSlug),
    queryFn: () => instancesApi.get(selectedSlug),
    enabled: !!selectedSlug && step >= 2,
  });

  useEffect(() => {
    if (fetchedManifest) setManifest(fetchedManifest);
  }, [fetchedManifest]);

  useEffect(() => {
    setBreadcrumbs([
      { label: "Instances", href: "/instances" },
      { label: "Setup Wizard" },
    ]);
  }, [setBreadcrumbs]);

  function canAdvance(): boolean {
    switch (step) {
      case 1:
        return !!selectedSlug;
      case 2:
        return !!selectedSlug;
      case 3:
        return true;
      case 4:
        if (provisionMode === "export_only") return true;
        return !!workspacePath.trim();
      case 5:
        return (
          validation?.overallStatus === "pass" ||
          validation?.overallStatus === "warn" ||
          provisionMode === "export_only"
        );
      case 6:
        return imported;
      default:
        return false;
    }
  }

  function handleNext() {
    if (!canAdvance()) return;
    if (step === 4 && provisionMode === "export_only") {
      // Skip validation for export-only
      setStep(6);
      return;
    }
    if (step < 6) {
      setStep((step + 1) as Step);
    }
  }

  function handleBack() {
    if (step === 6 && provisionMode === "export_only") {
      setStep(4);
      return;
    }
    if (step > 1) {
      setStep((step - 1) as Step);
    }
  }

  function handleImported() {
    setImported(true);
    queryClient.invalidateQueries({ queryKey: queryKeys.instances.all });
  }

  function handleNavigate(path: string) {
    navigate(path);
  }

  return (
    <div className="max-w-2xl mx-auto py-6">
      {/* Header */}
      <div className="flex items-center gap-2 mb-8">
        <Sparkles className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Instance Setup</span>
        <span className="text-sm text-muted-foreground/60">
          Step {step} of 6 - {STEP_LABELS[step]}
        </span>
        <div className="flex items-center gap-1.5 ml-auto">
          {([1, 2, 3, 4, 5, 6] as Step[]).map((s) => (
            <div
              key={s}
              className={cn(
                "h-1.5 w-6 rounded-full transition-colors",
                s < step
                  ? "bg-green-500"
                  : s === step
                    ? "bg-foreground"
                    : "bg-muted",
              )}
            />
          ))}
        </div>
      </div>

      {/* Step content */}
      <div className="min-h-[400px]">
        {step === 1 && (
          <>
            {instancesLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <WizardStepCompanyCreate
                instances={instances}
                selectedSlug={selectedSlug}
                onSelectSlug={setSelectedSlug}
              />
            )}
          </>
        )}
        {step === 2 && (
          <WizardStepBlueprintReview companySlug={selectedSlug} />
        )}
        {step === 3 && (
          <WizardStepProvisionRuntime
            mode={provisionMode}
            onModeChange={setProvisionMode}
          />
        )}
        {step === 4 && (
          <WizardStepOpenClawConnection
            mode={provisionMode}
            workspacePath={workspacePath}
            onWorkspacePathChange={setWorkspacePath}
            instanceName={instanceName}
            onInstanceNameChange={setInstanceName}
            environment={environment}
            onEnvironmentChange={setEnvironment}
            heartbeatMode={heartbeatMode}
            onHeartbeatModeChange={setHeartbeatMode}
            fileSyncMode={fileSyncMode}
            onFileSyncModeChange={setFileSyncMode}
          />
        )}
        {step === 5 && (
          <WizardStepValidate
            companySlug={selectedSlug}
            validation={validation}
            onValidationResult={setValidation}
          />
        )}
        {step === 6 && (
          <WizardStepLaunch
            companySlug={selectedSlug}
            manifest={manifest}
            imported={imported}
            onImported={handleImported}
            onNavigate={handleNavigate}
          />
        )}
      </div>

      {/* Footer navigation */}
      <div className="flex items-center justify-between mt-8 pt-4 border-t border-border">
        <div>
          {step > 1 && (
            <Button variant="ghost" size="sm" onClick={handleBack}>
              <ArrowLeft className="h-3.5 w-3.5 mr-1" />
              Back
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/instances")}
          >
            <X className="h-3.5 w-3.5 mr-1" />
            Cancel
          </Button>
          {step < 6 && (
            <Button
              size="sm"
              disabled={!canAdvance()}
              onClick={handleNext}
            >
              <ArrowRight className="h-3.5 w-3.5 mr-1" />
              Next
            </Button>
          )}
          {step === 6 && imported && (
            <Button
              size="sm"
              onClick={() => navigate("/dashboard")}
            >
              <ArrowRight className="h-3.5 w-3.5 mr-1" />
              Go to Dashboard
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
