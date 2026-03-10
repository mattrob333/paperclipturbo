import { useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams } from "@/lib/router";
import { useNavigate } from "@/lib/router";
import { Button } from "@/components/ui/button";
import { provisioningApi } from "../api/provisioning";
import {
  PROVISIONING_PHASES,
  PROVISIONING_PHASE_LABELS,
  PROVISIONING_PHASE_DESCRIPTIONS,
  type ProvisioningPhase,
  type ProvisioningLogEntry,
} from "@paperclipai/shared";
import {
  CheckCircle2,
  Circle,
  Loader2,
  AlertCircle,
  ArrowLeft,
  RefreshCw,
  ArrowRight,
} from "lucide-react";
import { cn } from "../lib/utils";

// --- Phase step indicator ---

function PhaseIcon({
  phase,
  currentPhase,
  jobStatus,
}: {
  phase: ProvisioningPhase;
  currentPhase: ProvisioningPhase;
  jobStatus: string;
}) {
  const phaseIdx = PROVISIONING_PHASES.indexOf(phase);
  const currentIdx = PROVISIONING_PHASES.indexOf(currentPhase);

  const isCompleted = phaseIdx < currentIdx || (jobStatus === "completed" && phaseIdx <= currentIdx);
  const isActive = phaseIdx === currentIdx && (jobStatus === "running" || jobStatus === "queued");
  const isFailed = phaseIdx === currentIdx && jobStatus === "failed";

  if (isCompleted) {
    return (
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400">
        <CheckCircle2 className="h-4 w-4" />
      </div>
    );
  }

  if (isFailed) {
    return (
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">
        <AlertCircle className="h-4 w-4" />
      </div>
    );
  }

  if (isActive) {
    return (
      <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
        <span className="absolute inset-0 animate-ping rounded-full bg-blue-200 opacity-40 dark:bg-blue-700" />
        <Loader2 className="relative h-4 w-4 animate-spin" />
      </div>
    );
  }

  // Upcoming
  return (
    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground">
      <Circle className="h-4 w-4" />
    </div>
  );
}

function PhaseSteps({
  currentPhase,
  jobStatus,
}: {
  currentPhase: ProvisioningPhase;
  jobStatus: string;
}) {
  const currentIdx = PROVISIONING_PHASES.indexOf(currentPhase);

  return (
    <div className="space-y-0">
      {PROVISIONING_PHASES.map((phase, i) => {
        const isLast = i === PROVISIONING_PHASES.length - 1;
        const phaseIdx = i;
        const isCompleted =
          phaseIdx < currentIdx || (jobStatus === "completed" && phaseIdx <= currentIdx);

        return (
          <div key={phase} className="flex gap-4">
            {/* Left column: icon + connector line */}
            <div className="flex flex-col items-center">
              <PhaseIcon
                phase={phase}
                currentPhase={currentPhase}
                jobStatus={jobStatus}
              />
              {!isLast && (
                <div
                  className={cn(
                    "w-px flex-1 min-h-[1.5rem]",
                    isCompleted
                      ? "bg-green-300 dark:bg-green-700"
                      : "bg-border",
                  )}
                />
              )}
            </div>

            {/* Right column: content */}
            <div className={cn("pb-4", isLast && "pb-0")}>
              <h3
                className={cn(
                  "text-sm font-medium",
                  phaseIdx > currentIdx && jobStatus !== "completed"
                    ? "text-muted-foreground"
                    : undefined,
                )}
              >
                {PROVISIONING_PHASE_LABELS[phase]}
              </h3>
              <p
                className={cn(
                  "mt-0.5 text-xs",
                  phaseIdx > currentIdx && jobStatus !== "completed"
                    ? "text-muted-foreground/60"
                    : "text-muted-foreground",
                )}
              >
                {PROVISIONING_PHASE_DESCRIPTIONS[phase]}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// --- Current phase progress card ---

function CurrentPhaseCard({
  currentPhase,
  phaseProgress,
  jobStatus,
  errorMessage,
}: {
  currentPhase: ProvisioningPhase;
  phaseProgress: number;
  jobStatus: string;
  errorMessage: string | null;
}) {
  const progressPct = Math.round(phaseProgress * 100);
  const isFailed = jobStatus === "failed";
  const isCompleted = jobStatus === "completed";
  const isRunning = jobStatus === "running" || jobStatus === "queued";

  return (
    <div className="rounded-lg border border-border bg-card p-6 space-y-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5">
          {isCompleted ? (
            <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
          ) : isFailed ? (
            <AlertCircle className="h-6 w-6 text-red-500 dark:text-red-400" />
          ) : (
            <Loader2 className="h-6 w-6 animate-spin text-blue-500 dark:text-blue-400" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold">
              {isCompleted ? "Provisioning Complete" : PROVISIONING_PHASE_LABELS[currentPhase]}
            </h2>
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                isCompleted
                  ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300"
                  : isFailed
                    ? "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300"
                    : "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300",
              )}
            >
              {isCompleted ? "Complete" : isFailed ? "Failed" : isRunning ? "Running" : "Queued"}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
            {isCompleted
              ? "All phases completed successfully. Your company is ready."
              : PROVISIONING_PHASE_DESCRIPTIONS[currentPhase]}
          </p>
        </div>
      </div>

      {/* Progress bar */}
      {!isCompleted && (
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-medium text-muted-foreground">
              {PROVISIONING_PHASE_LABELS[currentPhase]}
            </span>
            <span className="text-xs font-medium text-muted-foreground">{progressPct}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-muted">
            <div
              className={cn(
                "h-2 rounded-full transition-all duration-500",
                isFailed
                  ? "bg-red-500 dark:bg-red-400"
                  : "bg-blue-500 dark:bg-blue-400",
              )}
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      )}

      {/* Error display */}
      {isFailed && errorMessage && (
        <div className="rounded-md border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-4 w-4 text-red-500 dark:text-red-400 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-red-700 dark:text-red-400">Provisioning Error</p>
              <p className="mt-1 text-sm text-red-700 dark:text-red-400">{errorMessage}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Log view ---

function levelColor(level: ProvisioningLogEntry["level"]): string {
  switch (level) {
    case "warn":
      return "text-yellow-400";
    case "error":
      return "text-red-400";
    default:
      return "text-gray-300";
  }
}

function formatTime(timestamp: string): string {
  try {
    const d = new Date(timestamp);
    return d.toLocaleTimeString("en-US", { hour12: false });
  } catch {
    return timestamp;
  }
}

function ProvisioningLogView({ log }: { log: ProvisioningLogEntry[] }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.scrollTo(0, ref.current.scrollHeight);
  }, [log]);

  return (
    <div className="rounded-lg border border-border">
      <h2 className="px-4 py-3 text-xs font-medium uppercase text-muted-foreground border-b border-border">
        Log
      </h2>
      <div
        ref={ref}
        className="bg-gray-950 rounded-b-lg p-4 font-mono text-sm h-64 overflow-y-auto"
      >
        {log.length === 0 ? (
          <p className="text-gray-500">Waiting for output...</p>
        ) : (
          log.map((entry, i) => (
            <div key={i} className={cn("py-0.5", levelColor(entry.level))}>
              <span className="text-gray-600">[{formatTime(entry.ts)}]</span>{" "}
              <span className="text-gray-400">[{entry.phase}]</span>{" "}
              {entry.message}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// --- Main page ---

export default function ProvisioningProgress() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const {
    data: job,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["provisioning-job", jobId],
    queryFn: () => provisioningApi.getJob(jobId!),
    enabled: !!jobId,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data?.status && !["completed", "failed"].includes(data.status)) {
        return 2000;
      }
      return false;
    },
  });

  const retryMutation = useMutation({
    mutationFn: () => provisioningApi.retryJob(jobId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["provisioning-job", jobId] });
    },
  });

  if (!jobId) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        No provisioning job specified.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading provisioning status...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-sm text-destructive">
        {error instanceof Error ? error.message : "Failed to load provisioning status"}
      </div>
    );
  }

  if (!job) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        Provisioning job not found.
      </div>
    );
  }

  const isCompleted = job.status === "completed";
  const isFailed = job.status === "failed";

  return (
    <div className="mx-auto max-w-3xl p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/bootstrap")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-xl font-semibold">Provisioning Company</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Setting up your workspace and agents
          </p>
        </div>
      </div>

      {/* Phase progress stepper */}
      <div className="rounded-lg border border-border bg-card p-6">
        <h2 className="text-xs font-medium uppercase text-muted-foreground mb-4">
          Phase Progress
        </h2>
        <PhaseSteps currentPhase={job.currentPhase} jobStatus={job.status} />
      </div>

      {/* Current phase card */}
      <CurrentPhaseCard
        currentPhase={job.currentPhase}
        phaseProgress={job.phaseProgress}
        jobStatus={job.status}
        errorMessage={job.errorMessage}
      />

      {/* Log */}
      <ProvisioningLogView log={job.log ?? []} />

      {/* Success CTA */}
      {isCompleted && (
        <div className="rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-green-800 dark:text-green-300">
                Your Company is Ready
              </h2>
              <p className="mt-1 text-sm text-green-700 dark:text-green-400">
                All provisioning phases completed successfully. Your workspace has been
                initialized, agents are connected, and your company is active.
              </p>
            </div>
            <Button size="sm" onClick={() => navigate("/dashboard")}>
              Go to Dashboard
              <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          </div>
        </div>
      )}

      {/* Failure retry */}
      {isFailed && (
        <div className="flex justify-end">
          <Button
            variant="outline"
            onClick={() => retryMutation.mutate()}
            disabled={retryMutation.isPending}
          >
            {retryMutation.isPending ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-1 h-4 w-4" />
            )}
            Retry Provisioning
          </Button>
        </div>
      )}

      {/* Retry error */}
      {retryMutation.isError && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {retryMutation.error instanceof Error
            ? retryMutation.error.message
            : "Failed to retry provisioning"}
        </div>
      )}
    </div>
  );
}
