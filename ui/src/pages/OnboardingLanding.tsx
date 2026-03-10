import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@/lib/router";
import {
  UserCheck,
  Users,
  MessageSquare,
  BarChart3,
  FileText,
  Hammer,
  Check,
  Loader2,
  ArrowRight,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCompany } from "@/context/CompanyContext";
import { experienceApi } from "../api/experience";
import { cn } from "../lib/utils";
import {
  SETUP_STEPS,
  SETUP_STEP_CTAS,
  stepStatesFromExperienceState,
  activeStepIndex,
  type StepState,
} from "@/lib/setup-progress";
import type { ExperienceState } from "@paperclipai/shared";

const DEFAULT_ONBOARDING_ENTRY_PATH = "/onboarding/start";

const STEPS = SETUP_STEPS.map((step, i) => ({
  ...step,
  icon: [UserCheck, Users, MessageSquare, BarChart3, FileText, Hammer][i]!,
  pathFn: [
    (pid: string) => `/onboarding/${pid}/intake`,
    (pid: string) => `/onboarding/${pid}/participants`,
    (pid: string) => `/onboarding/${pid}`,
    (pid: string) => `/onboarding/${pid}/synthesis`,
    (pid: string) => `/onboarding/${pid}/proposal`,
    (pid: string) => `/build/${pid}`,
  ][i]!,
}));

function StepIcon({
  stepState,
  experienceState,
  icon: Icon,
  index,
}: {
  stepState: StepState;
  experienceState: ExperienceState;
  icon: React.ComponentType<{ className?: string }>;
  index: number;
}) {
  if (stepState === "completed") {
    return (
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400">
        <Check className="h-4 w-4" />
      </div>
    );
  }
  if (stepState === "active") {
    if (index === 5 && experienceState === "building") {
      return (
        <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
          <span className="absolute inset-0 animate-ping rounded-full bg-blue-200 opacity-40 dark:bg-blue-700" />
          <Loader2 className="relative h-4 w-4 animate-spin" />
        </div>
      );
    }
    if (index === 5 && experienceState === "build_failed") {
      return (
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">
          <AlertCircle className="h-4 w-4" />
        </div>
      );
    }
    return (
      <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
        <span className="absolute inset-0 animate-ping rounded-full bg-blue-200 opacity-40 dark:bg-blue-700" />
        <Icon className="relative h-4 w-4" />
      </div>
    );
  }
  // Upcoming: show step number
  return (
    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground">
      <span className="text-xs font-medium">{index + 1}</span>
    </div>
  );
}

export default function OnboardingLanding() {
  const { selectedCompanyId, selectedCompany } = useCompany();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: state, isLoading } = useQuery({
    queryKey: ["experience-state", selectedCompanyId],
    queryFn: () => experienceApi.getState(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const seedMutation = useMutation({
    mutationFn: () => experienceApi.seedDemo(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["experience-state"] });
      queryClient.invalidateQueries({ queryKey: ["companies"] });
    },
  });

  if (!selectedCompanyId) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        Select a company to begin onboarding.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        Loading onboarding status...
      </div>
    );
  }

  const experienceState: ExperienceState = state?.state ?? "not_started";
  const programId = state?.programId;
  const stepStates = stepStatesFromExperienceState(experienceState);
  const currentIdx = activeStepIndex(stepStates);
  const isProvisioned = experienceState === "provisioned";
  const isNotStarted = experienceState === "not_started" && !programId;

  // Hero subtitle
  const heroSubtitle = state?.programTitle
    ? `${selectedCompany?.name ?? "Company"} \u2014 ${state.programTitle}`
    : "Design and deploy your hybrid human-AI team";

  // Recommended next step text and path
  let nextStepText: string;
  let nextStepCta: string;
  let nextStepPath: string;

  if (isProvisioned) {
    nextStepText = "Setup complete \u2014 your team is ready";
    nextStepCta = "Go to Dashboard";
    nextStepPath = "/dashboard";
  } else if (isNotStarted) {
    nextStepText = "Begin by defining your executive goals and pilot scope";
    nextStepCta = "Get Started";
    nextStepPath = state?.nextActionPath ?? DEFAULT_ONBOARDING_ENTRY_PATH;
  } else {
    nextStepText = state?.nextAction ?? "Continue setup";
    nextStepCta = currentIdx != null ? SETUP_STEP_CTAS[currentIdx]! : "Continue";
    nextStepPath = state?.nextActionPath ?? DEFAULT_ONBOARDING_ENTRY_PATH;
  }

  return (
    <div className="p-6 space-y-6">
      {/* ── Hero Section ── */}
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold">Setup Journey</h1>
              {currentIdx != null && !isProvisioned && (
                <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                  Step {currentIdx + 1} of 6
                </span>
              )}
              {isProvisioned && (
                <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                  Complete
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{heroSubtitle}</p>
          </div>

          {/* Demo data loader — visually de-emphasized */}
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground"
            onClick={() => seedMutation.mutate()}
            disabled={seedMutation.isPending}
          >
            {seedMutation.isPending && (
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            )}
            Load Demo Data
          </Button>
        </div>

        {/* Recommended next step strip */}
        <div className="flex items-center justify-between gap-4 rounded-lg border border-l-4 border-l-blue-500 bg-muted/30 px-4 py-3">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Recommended Next Step
            </p>
            <p className="mt-0.5 text-sm font-medium truncate">{nextStepText}</p>
          </div>
          <Link to={nextStepPath} className="shrink-0">
            <Button size="sm">
              {nextStepCta}
              <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      </div>

      {/* ── Seed error ── */}
      {seedMutation.isError && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {seedMutation.error instanceof Error
            ? seedMutation.error.message
            : "Failed to load demo data"}
        </div>
      )}

      {/* ── Provisioned banner ── */}
      {isProvisioned && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-5 dark:border-green-800 dark:bg-green-900/20">
          <h2 className="text-sm font-semibold text-green-800 dark:text-green-300">
            Setup Complete
          </h2>
          <p className="mt-1 text-sm text-green-700 dark:text-green-400">
            Your hybrid team configuration is complete. Head to
            the dashboard to start working.
          </p>
        </div>
      )}

      {/* ── Vertical Stepper ── */}
      <div className="space-y-0">
        {STEPS.map((step, i) => {
          const stepState = stepStates[i]!;
          const isLast = i === STEPS.length - 1;

          // Determine whether to show a CTA button for this step
          const showCta = stepState === "active" && !isProvisioned;
          const ctaLabel =
            isNotStarted && i === 0 ? "Get Started" : SETUP_STEP_CTAS[i]!;
          const ctaPath = programId
            ? step.pathFn(programId)
            : state?.nextActionPath ?? DEFAULT_ONBOARDING_ENTRY_PATH;

          return (
            <div key={step.label} className="flex gap-4">
              {/* Left column: icon + connector line */}
              <div className="flex flex-col items-center">
                <StepIcon
                  stepState={stepState}
                  experienceState={experienceState}
                  icon={step.icon}
                  index={i}
                />
                {!isLast && (
                  <div
                    className={cn(
                      "w-px flex-1 min-h-[2rem]",
                      stepState === "completed"
                        ? "bg-green-300 dark:bg-green-700"
                        : "bg-border",
                    )}
                  />
                )}
              </div>

              {/* Right column: content */}
              <div className={cn("pb-6", isLast && "pb-0")}>
                <h3
                  className={cn(
                    "text-sm font-medium",
                    stepState === "upcoming" && "text-muted-foreground",
                  )}
                >
                  {step.label}
                </h3>
                <p
                  className={cn(
                    "mt-0.5 text-xs",
                    stepState === "upcoming"
                      ? "text-muted-foreground/60"
                      : "text-muted-foreground",
                  )}
                >
                  {step.description}
                </p>
                {showCta && (
                  <Link to={ctaPath}>
                    <Button size="sm" className="mt-2">
                      {ctaLabel}
                      <ArrowRight className="ml-1 h-3 w-3" />
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
