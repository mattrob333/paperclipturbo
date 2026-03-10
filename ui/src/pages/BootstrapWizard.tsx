import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useNavigate } from "@/lib/router";
import { Button } from "@/components/ui/button";
import { provisioningApi } from "../api/provisioning";
import type { InstanceReadiness, ReadinessCheck } from "@paperclipai/shared";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Loader2,
  ArrowRight,
  ArrowLeft,
  RefreshCw,
  Rocket,
} from "lucide-react";
import { cn } from "../lib/utils";

// --- Step indicator ---

function StepIndicator({ currentStep }: { currentStep: number }) {
  const steps = ["System Readiness", "Company Details", "Start Provisioning"];

  return (
    <div className="flex items-center justify-center gap-2">
      {steps.map((label, i) => {
        const isCompleted = i < currentStep;
        const isActive = i === currentStep;

        return (
          <div key={label} className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <div
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium",
                  isCompleted
                    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                    : isActive
                      ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                      : "bg-muted text-muted-foreground",
                )}
              >
                {isCompleted ? (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                ) : (
                  i + 1
                )}
              </div>
              <span
                className={cn(
                  "text-xs font-medium",
                  isActive ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={cn(
                  "h-px w-8",
                  isCompleted ? "bg-green-300 dark:bg-green-700" : "bg-border",
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// --- Readiness check row ---

function ReadinessCheckRow({ check }: { check: ReadinessCheck }) {
  return (
    <div className="flex items-start gap-3 py-2">
      <div className="mt-0.5">
        {check.ok ? (
          <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
        ) : (
          <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{check.name}</p>
        <p className="text-xs text-muted-foreground">{check.message}</p>
        {check.detail && (
          <p className="mt-0.5 text-xs text-muted-foreground/70">{check.detail}</p>
        )}
      </div>
    </div>
  );
}

// --- Step 1: Readiness ---

function ReadinessStep({
  onContinue,
  readiness,
  isLoading,
  error,
  onRefresh,
}: {
  onContinue: () => void;
  readiness: InstanceReadiness | undefined;
  isLoading: boolean;
  error: Error | null;
  onRefresh: () => void;
}) {
  const canContinue =
    readiness && (readiness.overallStatus === "ready" || readiness.overallStatus === "degraded");

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">System Readiness</h2>
        <p className="text-sm text-muted-foreground">
          Checking that the required services are reachable before setup.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        {isLoading ? (
          <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Running readiness checks...
          </div>
        ) : error ? (
          <div className="space-y-3">
            <div className="flex items-start gap-3 py-2">
              <XCircle className="h-4 w-4 mt-0.5 text-red-500 dark:text-red-400" />
              <div>
                <p className="text-sm font-medium text-red-700 dark:text-red-400">
                  Failed to check readiness
                </p>
                <p className="text-xs text-muted-foreground">
                  {error.message}
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={onRefresh}>
              <RefreshCw className="mr-1 h-3 w-3" />
              Retry
            </Button>
          </div>
        ) : readiness ? (
          <div className="space-y-1 divide-y divide-border">
            {readiness.checks.map((check) => (
              <ReadinessCheckRow key={check.name} check={check} />
            ))}
          </div>
        ) : null}

        {readiness && (
          <div className="mt-4 pt-3 border-t border-border">
            <div className="flex items-center gap-2">
              {readiness.overallStatus === "ready" ? (
                <>
                  <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                  <span className="text-sm font-medium text-green-700 dark:text-green-400">
                    All checks passed
                  </span>
                </>
              ) : readiness.overallStatus === "degraded" ? (
                <>
                  <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                  <span className="text-sm font-medium text-yellow-700 dark:text-yellow-400">
                    Some checks have warnings. You can continue, but some features may be limited.
                  </span>
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4 text-red-500 dark:text-red-400" />
                  <span className="text-sm font-medium text-red-700 dark:text-red-400">
                    Required checks failed. Fix the issues above and retry.
                  </span>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={onRefresh} disabled={isLoading}>
          <RefreshCw className="mr-1 h-3 w-3" />
          Re-check
        </Button>
        <Button onClick={onContinue} disabled={!canContinue}>
          Continue
          <ArrowRight className="ml-1 h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

// --- Step 2: Company Details ---

function CompanyDetailsStep({
  companyName,
  companyDescription,
  onCompanyNameChange,
  onCompanyDescriptionChange,
  onBack,
  onContinue,
}: {
  companyName: string;
  companyDescription: string;
  onCompanyNameChange: (value: string) => void;
  onCompanyDescriptionChange: (value: string) => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  const canContinue = companyName.trim().length > 0;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Company Details</h2>
        <p className="text-sm text-muted-foreground">
          Give your company a name and optional description.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label htmlFor="company-name" className="block text-sm font-medium mb-1.5">
            Company Name
          </label>
          <input
            id="company-name"
            type="text"
            value={companyName}
            onChange={(e) => onCompanyNameChange(e.target.value)}
            placeholder="e.g. Acme Corp"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            autoFocus
          />
        </div>

        <div>
          <label htmlFor="company-description" className="block text-sm font-medium mb-1.5">
            Description
            <span className="ml-1 text-xs text-muted-foreground font-normal">(optional)</span>
          </label>
          <textarea
            id="company-description"
            value={companyDescription}
            onChange={(e) => onCompanyDescriptionChange(e.target.value)}
            placeholder="Briefly describe what this company does"
            rows={3}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 resize-none"
          />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="mr-1 h-3 w-3" />
          Back
        </Button>
        <Button onClick={onContinue} disabled={!canContinue}>
          Continue
          <ArrowRight className="ml-1 h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

// --- Step 3: Confirm & Start ---

function StartStep({
  companyName,
  companyDescription,
  onBack,
  onStart,
  isPending,
  error,
}: {
  companyName: string;
  companyDescription: string;
  onBack: () => void;
  onStart: () => void;
  isPending: boolean;
  error: Error | null;
}) {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Start Provisioning</h2>
        <p className="text-sm text-muted-foreground">
          Review your settings and start the provisioning process.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Company Name
          </p>
          <p className="mt-0.5 text-sm font-medium">{companyName}</p>
        </div>
        {companyDescription && (
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Description
            </p>
            <p className="mt-0.5 text-sm text-muted-foreground">{companyDescription}</p>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-l-4 border-l-blue-500 bg-muted/30 px-4 py-3">
        <p className="text-sm text-muted-foreground">
          This will register your company, generate agent configurations,
          and activate the setup. The process typically takes 30-60 seconds.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {error.message}
        </div>
      )}

      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onBack} disabled={isPending}>
          <ArrowLeft className="mr-1 h-3 w-3" />
          Back
        </Button>
        <Button onClick={onStart} disabled={isPending}>
          {isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Rocket className="mr-2 h-4 w-4" />
          )}
          Start Provisioning
        </Button>
      </div>
    </div>
  );
}

// --- Main page ---

export default function BootstrapWizard() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [companyName, setCompanyName] = useState("");
  const [companyDescription, setCompanyDescription] = useState("");

  const {
    data: readiness,
    isLoading: readinessLoading,
    error: readinessError,
    refetch: refetchReadiness,
  } = useQuery({
    queryKey: ["provisioning-readiness"],
    queryFn: () => provisioningApi.getReadiness(),
  });

  const startMutation = useMutation({
    mutationFn: () =>
      provisioningApi.start({
        companyName: companyName.trim(),
        companyDescription: companyDescription.trim() || undefined,
      }),
    onSuccess: (result) => {
      navigate(`/provisioning/${result.job.id}`);
    },
  });

  return (
    <div className="mx-auto max-w-2xl p-6 space-y-8">
      {/* Header */}
      <div className="space-y-1 text-center">
        <h1 className="text-xl font-semibold">Set Up Your Company</h1>
        <p className="text-sm text-muted-foreground">
          Create and provision a new company with OpenClaw integration
        </p>
      </div>

      {/* Step indicator */}
      <StepIndicator currentStep={step} />

      {/* Step content */}
      <div className="rounded-lg border border-border bg-card p-6">
        {step === 0 && (
          <ReadinessStep
            onContinue={() => setStep(1)}
            readiness={readiness}
            isLoading={readinessLoading}
            error={readinessError instanceof Error ? readinessError : readinessError ? new Error("Unknown error") : null}
            onRefresh={() => refetchReadiness()}
          />
        )}

        {step === 1 && (
          <CompanyDetailsStep
            companyName={companyName}
            companyDescription={companyDescription}
            onCompanyNameChange={setCompanyName}
            onCompanyDescriptionChange={setCompanyDescription}
            onBack={() => setStep(0)}
            onContinue={() => setStep(2)}
          />
        )}

        {step === 2 && (
          <StartStep
            companyName={companyName}
            companyDescription={companyDescription}
            onBack={() => setStep(1)}
            onStart={() => startMutation.mutate()}
            isPending={startMutation.isPending}
            error={startMutation.error instanceof Error ? startMutation.error : null}
          />
        )}
      </div>
    </div>
  );
}
