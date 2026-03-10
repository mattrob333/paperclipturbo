import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "@/lib/router";
import { ArrowLeft, BarChart3, RefreshCw, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { onboardingApi } from "../api/onboarding";
import type { SynthesisArtifact } from "@paperclipai/shared";

const ARTIFACT_LABELS: Record<string, string> = {
  theme_summary: "Theme Summary",
  contradiction_report: "Contradiction Report",
  workflow_map: "Workflow Map",
  bottleneck_analysis: "Bottleneck Analysis",
  opportunity_assessment: "Opportunity Assessment",
  full_synthesis: "Full Synthesis",
};

const ARTIFACT_DESCRIPTIONS: Record<string, string> = {
  theme_summary: "Key themes and patterns identified across all interview responses.",
  contradiction_report: "Areas where team members provided divergent perspectives on the same topics.",
  workflow_map: "Current workflows and processes as described by your team.",
  bottleneck_analysis: "Operational bottlenecks ranked by frequency and impact.",
  opportunity_assessment: "AI augmentation opportunities matched with organizational readiness.",
  full_synthesis: "Executive summary combining all analytical findings.",
};

function ConfidenceBadge({ value }: { value: number | null }) {
  if (value == null) return null;
  const pct = Math.round(value * 100);
  const color = pct >= 70 ? "text-green-600 dark:text-green-400" : pct >= 40 ? "text-yellow-600 dark:text-yellow-400" : "text-red-500 dark:text-red-400";
  return <span className={`text-xs font-medium ${color}`}>{pct}% confidence</span>;
}

function ArtifactCard({ artifact }: { artifact: SynthesisArtifact }) {
  const [expanded, setExpanded] = useState(false);
  const label = ARTIFACT_LABELS[artifact.artifactType] ?? artifact.artifactType;

  return (
    <div className="rounded-lg border border-border p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-medium">{label}</h3>
          {artifact.summary && (
            <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{artifact.summary}</p>
          )}
        </div>
        <ConfidenceBadge value={artifact.confidenceSummary} />
      </div>
      <div className="mt-3">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          {expanded ? "Hide details" : "Show details"}
        </button>
        {expanded && (
          <pre className="mt-2 max-h-64 overflow-auto rounded-md border border-border bg-muted/30 p-3 text-xs">
            {JSON.stringify(artifact.payloadJson, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}

export function SynthesisPage() {
  const { programId } = useParams<{ programId: string }>();
  const queryClient = useQueryClient();

  const { data: program } = useQuery({
    queryKey: ["onboarding-program", programId],
    queryFn: () => onboardingApi.getProgram(programId!),
    enabled: !!programId,
  });

  const { data: artifacts, isLoading } = useQuery({
    queryKey: ["synthesis-artifacts", programId],
    queryFn: () => onboardingApi.listSynthesisArtifacts(programId!),
    enabled: !!programId,
  });

  const [showSuccess, setShowSuccess] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  const runMutation = useMutation({
    mutationFn: () => onboardingApi.runSynthesis(programId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["synthesis-artifacts", programId] });
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 4000);
    },
  });

  const clearMutation = useMutation({
    mutationFn: () => onboardingApi.clearSynthesis(programId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["synthesis-artifacts", programId] });
    },
  });

  const artifactList = artifacts ?? [];
  const hasArtifacts = artifactList.length > 0;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link to={`/onboarding/${programId}`}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-semibold">Analysis</h1>
            <p className="text-sm text-muted-foreground">
              {program?.title || "Setup Program"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasArtifacts && !confirmClear && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmClear(true)}
            >
              <Trash2 className="mr-1 h-3 w-3" />
              Clear &amp; Re-run
            </Button>
          )}
          {confirmClear && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Clear all insights?</span>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  clearMutation.mutate();
                  setConfirmClear(false);
                }}
                disabled={clearMutation.isPending}
              >
                Confirm
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirmClear(false)}
              >
                Cancel
              </Button>
            </div>
          )}
          <Button
            size="sm"
            onClick={() => runMutation.mutate()}
            disabled={runMutation.isPending}
          >
            {runMutation.isPending ? (
              <RefreshCw className="mr-1 h-3 w-3 animate-spin" />
            ) : (
              <BarChart3 className="mr-1 h-3 w-3" />
            )}
            {hasArtifacts ? "Re-run Analysis" : "Run Analysis"}
          </Button>
        </div>
      </div>

      {runMutation.isError && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {runMutation.error instanceof Error ? runMutation.error.message : "Failed to run synthesis"}
        </div>
      )}

      {showSuccess && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-900/20 dark:text-green-300">
          Analysis complete. {artifactList.length} insights generated from your team's interview data.
        </div>
      )}

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading analysis results...</div>
      ) : !hasArtifacts ? (
        <div className="rounded-lg border border-border p-8 text-center">
          <BarChart3 className="mx-auto h-8 w-8 text-muted-foreground/50" />
          <p className="mt-3 text-sm text-muted-foreground">
            No analysis results yet. Run analysis to extract insights from your team's interview responses.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {artifactList.map((artifact) => (
            <ArtifactCard key={artifact.id} artifact={artifact} />
          ))}
        </div>
      )}
    </div>
  );
}
