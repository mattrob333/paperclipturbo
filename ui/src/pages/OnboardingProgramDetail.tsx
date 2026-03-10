import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "@/lib/router";
import {
  ClipboardList,
  Users,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  BarChart3,
  FileText,
  Check,
  Hammer,
} from "lucide-react";
import { onboardingApi } from "../api/onboarding";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SETUP_STEP_RECOMMENDATIONS, type StepState } from "@/lib/setup-progress";

const PHASE_LABELS: Record<string, string> = {
  sponsor_intake: "Executive Goals",
  discovery: "Team Interviews",
  synthesis: "Analysis",
  proposal: "Org Design",
  provisioning: "Build & Deploy",
};
const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  complete: "Complete",
  provisioning: "Building",
};

function deriveStep(
  intake: unknown,
  participantCount: number,
  synthesisArtifactCount: number,
  proposal: { status: string } | null | undefined,
): number {
  if (!intake) return 0;
  if (participantCount === 0) return 1;
  if (synthesisArtifactCount === 0) return 2;
  if (!proposal) return 3;
  if (proposal.status === "org_approved" || proposal.status === "provisioning_approved") return 5;
  return 4;
}

function cardState(stepIndex: number, currentStep: number): StepState {
  if (stepIndex < currentStep) return "completed";
  if (stepIndex === currentStep) return "active";
  return "upcoming";
}

function cardBorderClass(state: StepState): string {
  switch (state) {
    case "completed":
      return "border-l-4 border-l-green-500";
    case "active":
      return "border-l-4 border-l-blue-500";
    case "upcoming":
      return "";
  }
}

export function OnboardingProgramDetail() {
  const { programId } = useParams<{ programId: string }>();

  const { data: program, isLoading: loadingProgram } = useQuery({
    queryKey: ["onboarding-program", programId],
    queryFn: () => onboardingApi.getProgram(programId!),
    enabled: !!programId,
  });

  const { data: intake } = useQuery({
    queryKey: ["onboarding-intake", programId],
    queryFn: () => onboardingApi.getIntake(programId!),
    enabled: !!programId,
    retry: false,
  });

  const { data: participants } = useQuery({
    queryKey: ["onboarding-participants", programId],
    queryFn: () => onboardingApi.listParticipants(programId!),
    enabled: !!programId,
  });

  const { data: detail } = useQuery({
    queryKey: ["onboarding-program-detail", programId],
    queryFn: () => onboardingApi.getProgramDetail(programId!),
    enabled: !!programId,
  });

  if (loadingProgram) {
    return <div className="p-6 text-sm text-muted-foreground">Loading onboarding program...</div>;
  }

  if (!program) {
    return <div className="p-6 text-sm text-muted-foreground">Onboarding program not found.</div>;
  }

  const participantList = participants ?? [];
  const firstParticipant = participantList[0] ?? null;
  const synthesisCount = detail?.synthesisArtifactCount ?? 0;

  const currentStep = deriveStep(intake, participantList.length, synthesisCount, detail?.proposal);
  const completedSteps = Math.min(currentStep, 5);

  // Card states for each step (0-4 for the five cards, plus step 5 for build)
  const goalsState = cardState(0, currentStep);
  const teamState = cardState(1, currentStep);
  const interviewsState = cardState(2, currentStep);
  const analysisState = cardState(3, currentStep);
  const orgDesignState = cardState(4, currentStep);
  const buildState: StepState =
    currentStep >= 5 ? "active" : "upcoming";

  return (
    <div className="p-6 space-y-6">
      {/* Header with back navigation */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link to="/onboarding/start">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-semibold">{program.title || "Untitled Program"}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Phase: {PHASE_LABELS[program.phase] ?? program.phase} · Status: {STATUS_LABELS[program.status] ?? program.status}
            </p>
          </div>
        </div>
      </div>

      {/* Status summary strip */}
      <div className="rounded-lg border border-border bg-muted/40 p-4 flex flex-wrap items-center gap-4">
        <span className="inline-flex items-center rounded-full bg-primary/10 text-primary px-3 py-1 text-xs font-medium">
          {PHASE_LABELS[program.phase] ?? program.phase}
        </span>
        <span className="text-sm text-muted-foreground">
          Step {completedSteps} of 5 complete
        </span>
        <span className="text-sm font-medium ml-auto">
          Next: {SETUP_STEP_RECOMMENDATIONS[currentStep] ?? SETUP_STEP_RECOMMENDATIONS[5]}
        </span>
      </div>

      {/* Top row: 3-column grid */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Executive Goals card */}
        <div
          className={cn(
            "rounded-lg border border-border p-4",
            cardBorderClass(goalsState),
            goalsState === "upcoming" && "opacity-60",
          )}
        >
          <div className="flex items-center gap-2 text-sm font-medium">
            <ClipboardList className="h-4 w-4" />
            Executive Goals
            {goalsState === "completed" && <Check className="h-4 w-4 text-green-500 ml-auto" />}
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {goalsState === "completed"
              ? "Strategic objectives and constraints defined."
              : "Define your strategic objectives, risk tolerance, and deployment constraints."}
          </p>
          <p className="mt-3 text-xs text-muted-foreground">
            {intake
              ? intake.completedAt
                ? "Completed"
                : "In progress"
              : "Not started"}
          </p>
          <div className="mt-4">
            {goalsState === "upcoming" ? (
              <Button size="sm" className="w-full" disabled>
                Requires previous step
              </Button>
            ) : (
              <Link to={`/onboarding/${program.id}/intake`}>
                <Button
                  size="sm"
                  variant={goalsState === "completed" ? "outline" : "default"}
                  className="w-full justify-between"
                >
                  {goalsState === "completed" ? "Review Goals" : "Define Goals"}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            )}
          </div>
        </div>

        {/* Team Setup card */}
        <div
          className={cn(
            "rounded-lg border border-border p-4",
            cardBorderClass(teamState),
            teamState === "upcoming" && "opacity-60",
          )}
        >
          <div className="flex items-center gap-2 text-sm font-medium">
            <Users className="h-4 w-4" />
            Team Setup
            {teamState === "completed" && <Check className="h-4 w-4 text-green-500 ml-auto" />}
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {teamState === "completed"
              ? `${participantList.length} team member${participantList.length === 1 ? "" : "s"} added.`
              : "Add and manage the team members who will complete discovery."}
          </p>
          <p className="mt-3 text-xs text-muted-foreground">
            {participantList.length} member{participantList.length === 1 ? "" : "s"}
          </p>
          <div className="mt-4">
            {teamState === "upcoming" ? (
              <Button size="sm" className="w-full" disabled>
                Requires previous step
              </Button>
            ) : (
              <Link to={`/onboarding/${program.id}/participants`}>
                <Button
                  size="sm"
                  variant={teamState === "completed" ? "outline" : "default"}
                  className="w-full justify-between"
                >
                  {teamState === "completed" ? "Manage Team" : "Add Team Members"}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            )}
          </div>
        </div>

        {/* Team Interviews card */}
        <div
          className={cn(
            "rounded-lg border border-border p-4",
            cardBorderClass(interviewsState),
            interviewsState === "upcoming" && "opacity-60",
          )}
        >
          <div className="flex items-center gap-2 text-sm font-medium">
            <Sparkles className="h-4 w-4" />
            Team Interviews
            {interviewsState === "completed" && <Check className="h-4 w-4 text-green-500 ml-auto" />}
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {interviewsState === "completed"
              ? "Interview data collected from team members."
              : "Run guided interviews to gather workflows, pain points, and readiness signals."}
          </p>
          <p className="mt-3 text-xs text-muted-foreground">
            {interviewsState === "upcoming"
              ? "Add at least one team member first"
              : firstParticipant
                ? `Ready to launch for ${firstParticipant.name}`
                : "Add at least one team member first"}
          </p>
          <div className="mt-4">
            {interviewsState === "upcoming" ? (
              <Button size="sm" className="w-full" disabled>
                Requires previous step
              </Button>
            ) : firstParticipant ? (
              <Link to={`/onboarding/${program.id}/discovery/${firstParticipant.id}`}>
                <Button
                  size="sm"
                  variant={interviewsState === "completed" ? "outline" : "default"}
                  className="w-full justify-between"
                >
                  {interviewsState === "completed" ? "Review Interviews" : "Begin Interviews"}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            ) : (
              <Button size="sm" className="w-full" disabled>
                Begin Interviews
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Bottom row: 2-column grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Analysis card */}
        <div
          className={cn(
            "rounded-lg border border-border p-4",
            cardBorderClass(analysisState),
            analysisState === "upcoming" && "opacity-60",
          )}
        >
          <div className="flex items-center gap-2 text-sm font-medium">
            <BarChart3 className="h-4 w-4" />
            Analysis
            {analysisState === "completed" && <Check className="h-4 w-4 text-green-500 ml-auto" />}
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {analysisState === "completed"
              ? "Themes, contradictions, and opportunities extracted."
              : "Analyze interview responses to extract themes, contradictions, workflows, and opportunities."}
          </p>
          <p className="mt-3 text-xs text-muted-foreground">
            {analysisState === "upcoming"
              ? "Requires previous step"
              : synthesisCount
                ? `${synthesisCount} insight${synthesisCount === 1 ? "" : "s"} generated`
                : "Not yet run"}
          </p>
          <div className="mt-4">
            {analysisState === "upcoming" ? (
              <Button size="sm" className="w-full" disabled>
                Requires previous step
              </Button>
            ) : (
              <Link to={`/onboarding/${program.id}/synthesis`}>
                <Button
                  size="sm"
                  variant={analysisState === "completed" ? "outline" : "default"}
                  className="w-full justify-between"
                >
                  {synthesisCount ? "View Analysis" : "Run Analysis"}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            )}
          </div>
        </div>

        {/* Org Design card */}
        <div
          className={cn(
            "rounded-lg border border-border p-4",
            cardBorderClass(orgDesignState),
            orgDesignState === "upcoming" && "opacity-60",
          )}
        >
          <div className="flex items-center gap-2 text-sm font-medium">
            <FileText className="h-4 w-4" />
            Org Design
            {orgDesignState === "completed" && <Check className="h-4 w-4 text-green-500 ml-auto" />}
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {orgDesignState === "completed"
              ? "Hybrid organization proposal reviewed."
              : "Generate and review a hybrid organization proposal based on analysis findings."}
          </p>
          <p className="mt-3 text-xs text-muted-foreground">
            {orgDesignState === "upcoming"
              ? "Requires previous step"
              : detail?.proposal
                ? `Status: ${detail.proposal.status.replace(/_/g, " ")}`
                : "Not yet generated"}
          </p>
          <div className="mt-4">
            {orgDesignState === "upcoming" ? (
              <Button size="sm" className="w-full" disabled>
                Requires previous step
              </Button>
            ) : (
              <Link to={`/onboarding/${program.id}/proposal`}>
                <Button
                  size="sm"
                  variant={orgDesignState === "completed" ? "outline" : "default"}
                  className="w-full justify-between"
                >
                  {detail?.proposal ? "Review Proposal" : "Generate Proposal"}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Build & Deploy card (full width) */}
      <div
        className={cn(
          "rounded-lg border border-border p-4",
          cardBorderClass(buildState),
          buildState === "upcoming" && "opacity-60",
        )}
      >
        <div className="flex items-center gap-2 text-sm font-medium">
          <Hammer className="h-4 w-4" />
          Build & Deploy
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Compile your org design into agent workspaces and provision the hybrid team.
        </p>
        <p className="mt-3 text-xs text-muted-foreground">
          {buildState === "upcoming"
            ? "Complete org design approval to proceed"
            : "Ready to build"}
        </p>
        <div className="mt-4">
          {buildState === "upcoming" ? (
            <Button size="sm" className="w-full" disabled>
              Complete org design approval to proceed
            </Button>
          ) : (
            <Link to={`/build/${program.id}`}>
              <Button size="sm" className="w-full justify-between">
                Build & Deploy
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
