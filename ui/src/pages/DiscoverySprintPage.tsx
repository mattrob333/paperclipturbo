import { useState, useMemo, useEffect, useCallback } from "react";
import { useParams } from "@/lib/router";
import { Link } from "@/lib/router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Loader2,
  MessageSquare,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { onboardingApi } from "../api/onboarding";
import { cn } from "@/lib/utils";
import type {
  DiscoveryQuestion,
  DiscoveryResponse,
  OnboardingParticipant,
  DiscoveryBucket,
} from "@paperclipai/shared";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

interface BucketMeta {
  label: string;
  description: string;
  placeholder: string;
}

const BUCKET_META: Record<DiscoveryBucket, BucketMeta> = {
  role_and_responsibilities: {
    label: "Role & Responsibilities",
    description: "Help us understand your position and key duties",
    placeholder:
      "Describe your role, main responsibilities, and how your work connects to broader team goals...",
  },
  daily_workflow: {
    label: "Daily Workflow",
    description: "Walk us through your typical day and recurring processes",
    placeholder:
      "Think about a typical day or week \u2014 what tasks repeat, what tools do you use, and where do you spend the most time...",
  },
  collaboration: {
    label: "Collaboration",
    description: "How you work with other teams and stakeholders",
    placeholder:
      "Describe who you collaborate with most, how information flows, and what makes collaboration effective or difficult...",
  },
  pain_points: {
    label: "Pain Points",
    description: "Where things slow down, break, or frustrate",
    placeholder:
      "Be specific about bottlenecks, manual steps that feel unnecessary, or processes that consistently cause frustration...",
  },
  ai_readiness: {
    label: "AI Readiness",
    description: "Your perspective on automation and AI adoption",
    placeholder:
      "Share your experience with automation tools, what you would like AI to handle, and any concerns about adopting AI...",
  },
};

const BUCKET_ORDER: DiscoveryBucket[] = [
  "role_and_responsibilities",
  "daily_workflow",
  "collaboration",
  "pain_points",
  "ai_readiness",
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface BucketSection {
  bucket: DiscoveryBucket;
  meta: BucketMeta;
  questions: DiscoveryQuestion[];
}

function groupByBucket(questions: DiscoveryQuestion[]): BucketSection[] {
  const map = new Map<DiscoveryBucket, DiscoveryQuestion[]>();
  for (const q of questions) {
    const list = map.get(q.bucket) ?? [];
    list.push(q);
    map.set(q.bucket, list);
  }
  return BUCKET_ORDER.filter((b) => map.has(b)).map((bucket) => ({
    bucket,
    meta: BUCKET_META[bucket],
    questions: map.get(bucket)!.sort((a, b) => a.sequence - b.sequence),
  }));
}

function isQuestionAnswered(
  questionId: string,
  localAnswers: Record<string, string>,
  serverResponses: DiscoveryResponse[] | undefined,
): boolean {
  const local = localAnswers[questionId];
  if (local !== undefined && local.trim().length > 0) return true;
  const server = serverResponses?.find((r) => r.questionId === questionId);
  return !!server && server.rawText.trim().length > 0;
}

function getAnswerText(
  questionId: string,
  localAnswers: Record<string, string>,
  serverResponses: DiscoveryResponse[] | undefined,
): string {
  if (localAnswers[questionId] !== undefined) return localAnswers[questionId];
  return serverResponses?.find((r) => r.questionId === questionId)?.rawText ?? "";
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Pill navigation showing section completion status */
function SectionPills({
  sections,
  activeSectionIndex,
  localAnswers,
  serverResponses,
  onSectionClick,
}: {
  sections: BucketSection[];
  activeSectionIndex: number;
  localAnswers: Record<string, string>;
  serverResponses: DiscoveryResponse[] | undefined;
  onSectionClick: (sectionIndex: number) => void;
}) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {sections.map((section, i) => {
        const allAnswered = section.questions.every((q) =>
          isQuestionAnswered(q.id, localAnswers, serverResponses),
        );
        const isActive = i === activeSectionIndex;

        return (
          <button
            key={section.bucket}
            onClick={() => onSectionClick(i)}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors",
              isActive
                ? "bg-primary text-primary-foreground"
                : allAnswered
                  ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                  : "bg-muted text-muted-foreground hover:bg-muted/80",
            )}
            title={section.meta.label}
          >
            {allAnswered && !isActive && <Check className="h-3 w-3" />}
            <span className="hidden sm:inline">{section.meta.label}</span>
            <span className="sm:hidden">{i + 1}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Save confirmation toast */
function SaveIndicator({
  isPending,
  showSaved,
}: {
  isPending: boolean;
  showSaved: boolean;
}) {
  if (isPending) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground animate-pulse">
        <Loader2 className="h-3 w-3 animate-spin" />
        Saving...
      </span>
    );
  }
  if (showSaved) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-green-700 dark:text-green-400">
        <Check className="h-3 w-3" />
        Saved
      </span>
    );
  }
  return null;
}

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------

export function DiscoverySprintPage() {
  const { programId, participantId } = useParams<{
    programId: string;
    participantId: string;
  }>();
  const queryClient = useQueryClient();

  // --- Local state ---
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [showSaved, setShowSaved] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  // --- Queries ---
  const {
    data: questions,
    isLoading: loadingQ,
    isError: errorQ,
    refetch: refetchQ,
  } = useQuery({
    queryKey: ["discovery-questions", programId],
    queryFn: () => onboardingApi.getQuestions(programId!),
    enabled: !!programId,
  });

  const { data: existingResponses } = useQuery({
    queryKey: ["discovery-responses", programId, participantId],
    queryFn: () => onboardingApi.getResponses(programId!, participantId!),
    enabled: !!programId && !!participantId,
  });

  const { data: participant } = useQuery({
    queryKey: ["discovery-participant", programId, participantId],
    queryFn: async () => {
      const list = await onboardingApi.listParticipants(programId!);
      return list.find((p: OnboardingParticipant) => p.id === participantId) ?? null;
    },
    enabled: !!programId && !!participantId,
  });

  const { data: program } = useQuery({
    queryKey: ["onboarding-program", programId],
    queryFn: () => onboardingApi.getProgram(programId!),
    enabled: !!programId,
  });

  const { data: participantProgress } = useQuery({
    queryKey: ["discovery-progress", programId, participantId],
    queryFn: () => onboardingApi.getDiscoveryProgress(programId!, participantId!),
    enabled: !!programId && !!participantId,
  });

  // --- Mutations ---
  const submitMutation = useMutation({
    mutationFn: (data: { questionId: string; rawText: string }) =>
      onboardingApi.submitResponse(programId!, {
        participantId: participantId!,
        questionId: data.questionId,
        rawText: data.rawText,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["discovery-responses", programId, participantId],
      });
      queryClient.invalidateQueries({
        queryKey: ["discovery-progress", programId, participantId],
      });
      setShowSaved(true);
    },
  });

  const completeMutation = useMutation({
    mutationFn: () =>
      onboardingApi.completeDiscovery(programId!, participantId!),
    onSuccess: (result) => {
      setIsComplete(result.completed);
      queryClient.invalidateQueries({
        queryKey: ["discovery-responses", programId, participantId],
      });
      queryClient.invalidateQueries({
        queryKey: ["discovery-progress", programId, participantId],
      });
      queryClient.invalidateQueries({
        queryKey: ["onboarding-participants", programId],
      });
    },
  });

  // --- Derived data ---
  const sections = useMemo(
    () => (questions ? groupByBucket(questions) : []),
    [questions],
  );

  const flatQuestions = useMemo(
    () => sections.flatMap((s) => s.questions),
    [sections],
  );

  const currentQuestion = flatQuestions[currentIndex] ?? null;

  // Find which section the current question belongs to
  const { activeSectionIndex, questionIndexInSection, sectionQuestionCount } =
    useMemo(() => {
      let offset = 0;
      for (let i = 0; i < sections.length; i++) {
        const section = sections[i];
        if (currentIndex < offset + section.questions.length) {
          return {
            activeSectionIndex: i,
            questionIndexInSection: currentIndex - offset,
            sectionQuestionCount: section.questions.length,
          };
        }
        offset += section.questions.length;
      }
      return {
        activeSectionIndex: 0,
        questionIndexInSection: 0,
        sectionQuestionCount: 0,
      };
    }, [sections, currentIndex]);

  const activeSection = sections[activeSectionIndex] ?? null;

  const answeredCount = useMemo(
    () =>
      flatQuestions.filter((q) =>
        isQuestionAnswered(q.id, answers, existingResponses),
      ).length,
    [flatQuestions, answers, existingResponses],
  );

  const currentAnswerText = currentQuestion
    ? getAnswerText(currentQuestion.id, answers, existingResponses)
    : "";

  const progressPercent =
    flatQuestions.length > 0
      ? Math.round((answeredCount / flatQuestions.length) * 100)
      : 0;

  const serverMarkedComplete = participant?.status === "completed";
  const persistedComplete = participantProgress?.isComplete ?? false;
  const effectiveIsComplete = isComplete || serverMarkedComplete || persistedComplete;

  // --- Auto-hide save indicator ---
  useEffect(() => {
    if (!showSaved) return;
    const timer = setTimeout(() => setShowSaved(false), 2000);
    return () => clearTimeout(timer);
  }, [showSaved]);

  // --- Handlers ---
  const saveCurrentAnswer = useCallback(() => {
    if (!currentQuestion) return;
    const text = answers[currentQuestion.id];
    if (text !== undefined && text.trim().length > 0) {
      submitMutation.mutate({
        questionId: currentQuestion.id,
        rawText: text,
      });
    }
  }, [currentQuestion, answers, submitMutation]);

  function handleNext() {
    saveCurrentAnswer();
    if (currentIndex < flatQuestions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  }

  function handlePrev() {
    saveCurrentAnswer();
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  }

  function handleComplete() {
    if (!allQuestionsAnswered) return;
    saveCurrentAnswer();
    completeMutation.mutate();
  }

  function handleSectionClick(sectionIndex: number) {
    saveCurrentAnswer();
    let offset = 0;
    for (let i = 0; i < sectionIndex; i++) {
      offset += sections[i].questions.length;
    }
    setCurrentIndex(offset);
  }

  // ---------------------------------------------------------------------------
  // Render: Loading state
  // ---------------------------------------------------------------------------
  if (loadingQ) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          <p className="text-sm">Loading interview questions...</p>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render: Error state
  // ---------------------------------------------------------------------------
  if (errorQ) {
    return (
      <div className="p-6 max-w-2xl mx-auto space-y-4">
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div className="space-y-2">
            <p className="text-sm font-medium text-destructive">
              Failed to load interview questions
            </p>
            <p className="text-xs text-muted-foreground">
              Something went wrong while fetching the questions. Please try
              again.
            </p>
            <Button size="sm" variant="outline" onClick={() => refetchQ()}>
              Retry
            </Button>
          </div>
        </div>
        <Link to={`/onboarding/${programId}`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Back to Program
          </Button>
        </Link>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render: Empty / no questions
  // ---------------------------------------------------------------------------
  if (!questions || questions.length === 0) {
    return (
      <div className="p-6 max-w-2xl mx-auto space-y-4">
        <div className="rounded-lg border border-border bg-muted/30 p-8 text-center">
          <MessageSquare className="mx-auto h-10 w-10 text-muted-foreground/30" />
          <h2 className="mt-4 text-sm font-semibold">
            No Interview Questions Available
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Discovery questions haven't been generated for this program yet.
            Return to the program overview to check the setup status.
          </p>
          <Link to={`/onboarding/${programId}`}>
            <Button size="sm" className="mt-4">
              <ArrowLeft className="h-4 w-4 mr-1.5" />
              Back to Program
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render: Completion state
  // ---------------------------------------------------------------------------
  if (effectiveIsComplete) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="rounded-lg border border-green-200 dark:border-green-800/50 bg-green-50 dark:bg-green-900/20 p-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/40">
            <CheckCircle2 className="h-7 w-7 text-green-600 dark:text-green-400" />
          </div>
          <h2 className="mt-4 text-lg font-semibold text-green-800 dark:text-green-300">
            Interview Complete
          </h2>
          <p className="mt-2 text-sm text-green-700 dark:text-green-400">
            You've answered all {flatQuestions.length} questions. Your responses
            will be analyzed in the next step.
          </p>
          {participant && (
            <p className="mt-1 text-xs text-green-600 dark:text-green-500">
              Completed by {participant.name}
              {participant.title ? ` \u2014 ${participant.title}` : ""}
            </p>
          )}
          <Link to={`/onboarding/${programId}`}>
            <Button size="sm" className="mt-6">
              Return to Program
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render: Main interview experience
  // ---------------------------------------------------------------------------
  const isLastQuestion = currentIndex === flatQuestions.length - 1;
  const allAnswered = answeredCount === flatQuestions.length;
  const allQuestionsAnswered = participantProgress?.isComplete ?? allAnswered;

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      {/* ── Header with context ── */}
      <div className="space-y-3">
        <div className="flex items-start gap-3">
          <Link to={`/onboarding/${programId}`}>
            <Button variant="ghost" size="sm" className="shrink-0 -ml-2">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-semibold">Discovery Interview</h1>
              <span className="rounded-full bg-blue-100 dark:bg-blue-900/30 px-2.5 py-0.5 text-xs font-medium text-blue-700 dark:text-blue-300">
                Step 3 of 6 &mdash; Team Interviews
              </span>
            </div>
            {participant && (
              <p className="mt-1 text-sm text-muted-foreground truncate">
                {participant.name}
                {participant.title ? ` \u2014 ${participant.title}` : ""}
                {participant.department
                  ? ` \u00b7 ${participant.department}`
                  : ""}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── Overall progress strip ── */}
      <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 space-y-3">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium">
            {answeredCount} of {flatQuestions.length} questions answered
          </span>
          <span className="text-muted-foreground">{progressPercent}%</span>
        </div>
        <div className="w-full bg-muted rounded-full h-1.5">
          <div
            className="bg-primary rounded-full h-1.5 transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        {/* Section pills */}
        <SectionPills
          sections={sections}
          activeSectionIndex={activeSectionIndex}
          localAnswers={answers}
          serverResponses={existingResponses}
          onSectionClick={handleSectionClick}
        />
      </div>

      {/* ── Section header ── */}
      {activeSection && (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Section {activeSectionIndex + 1} of {sections.length}
            </span>
            <span className="text-xs text-muted-foreground">&mdash;</span>
            <span className="text-xs font-medium uppercase tracking-wide text-primary">
              {activeSection.meta.label}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            {activeSection.meta.description}
          </p>
        </div>
      )}

      {/* ── Question card ── */}
      {currentQuestion && (
        <div className="rounded-lg border border-border bg-card p-6 space-y-4">
          {/* Question number + answered indicator */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              Question {questionIndexInSection + 1} of {sectionQuestionCount}
            </span>
            <div className="flex items-center gap-2">
              <SaveIndicator
                isPending={submitMutation.isPending}
                showSaved={showSaved}
              />
              {isQuestionAnswered(
                currentQuestion.id,
                answers,
                existingResponses,
              ) && !submitMutation.isPending && !showSaved && (
                <span className="inline-flex items-center gap-1 text-xs text-green-700 dark:text-green-400">
                  <Check className="h-3 w-3" />
                  Answered
                </span>
              )}
            </div>
          </div>

          {/* Question text */}
          <h2 className="text-base font-medium leading-relaxed">
            {currentQuestion.prompt}
          </h2>

          {/* Answer input */}
          {currentQuestion.inputType === "text" ? (
            <input
              className="w-full rounded-md border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
              value={currentAnswerText}
              onChange={(e) =>
                setAnswers({ ...answers, [currentQuestion.id]: e.target.value })
              }
              placeholder={activeSection?.meta.placeholder ?? "Your answer..."}
            />
          ) : (
            <textarea
              className="w-full rounded-md border border-border bg-background px-4 py-3 text-sm min-h-[160px] resize-y focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
              value={currentAnswerText}
              onChange={(e) =>
                setAnswers({ ...answers, [currentQuestion.id]: e.target.value })
              }
              placeholder={
                activeSection?.meta.placeholder ??
                "Take your time to answer thoughtfully..."
              }
            />
          )}
        </div>
      )}

      {/* ── Navigation ── */}
      <div className="flex items-center justify-between pt-2">
        <Button
          variant="outline"
          onClick={handlePrev}
          disabled={currentIndex === 0}
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Previous
        </Button>

        <div className="flex items-center gap-2">
          {isLastQuestion ? (
            <Button
              onClick={handleComplete}
              disabled={
                completeMutation.isPending || submitMutation.isPending || !allQuestionsAnswered
              }
              className={cn(
                allQuestionsAnswered &&
                  "bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600",
              )}
            >
              {completeMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4 mr-1.5" />
              )}
              {completeMutation.isPending ? "Completing..." : "Complete Interview"}
            </Button>
          ) : (
            <Button onClick={handleNext} disabled={submitMutation.isPending}>
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          )}
        </div>
      </div>

      {/* ── Completion mutation error ── */}
      {completeMutation.isError && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
          <p className="text-sm text-destructive">
            {completeMutation.error instanceof Error
              ? completeMutation.error.message
              : "Failed to mark interview as complete. Please try again."}
          </p>
        </div>
      )}

      {!allQuestionsAnswered && isLastQuestion && (
        <div className="rounded-lg border border-border bg-muted/30 px-4 py-3">
          <p className="text-xs text-muted-foreground">
            Answer every question before completing the interview.
          </p>
        </div>
      )}

      {/* ── Next steps hint ── */}
      {allQuestionsAnswered && !isLastQuestion && (
        <div className="rounded-lg border border-border bg-blue-50 dark:bg-blue-900/20 px-4 py-3">
          <p className="text-xs text-blue-700 dark:text-blue-300">
            All questions answered. Navigate to the last question and click{" "}
            <strong>Complete Interview</strong> when you're ready to submit.
          </p>
        </div>
      )}
    </div>
  );
}
