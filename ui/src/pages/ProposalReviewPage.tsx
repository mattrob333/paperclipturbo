import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "@/lib/router";
import { ArrowLeft, FileText, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { onboardingApi } from "../api/onboarding";
import type { OnboardingProposal, ProposalStatus } from "@paperclipai/shared";

const STATUS_LABELS: Record<ProposalStatus, string> = {
  draft: "Draft",
  pending_review: "Pending Review",
  findings_approved: "Findings Approved",
  org_approved: "Org Design Approved",
  provisioning_approved: "Provisioning Approved",
  revision_requested: "Revision Requested",
};

const STATUS_COLORS: Record<ProposalStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  pending_review: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  findings_approved: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  org_approved: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300",
  provisioning_approved: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  revision_requested: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
};

function StatusBadge({ status }: { status: ProposalStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

function StatusActions({
  proposal,
  onTransition,
  onRevisionRequest,
  isPending,
}: {
  proposal: OnboardingProposal;
  onTransition: (status: ProposalStatus, notes?: string) => void;
  onRevisionRequest: () => void;
  isPending: boolean;
}) {
  const s = proposal.status;

  const btn = (label: string, target: ProposalStatus, variant: "default" | "outline" = "default") => (
    <Button
      size="sm"
      variant={variant}
      onClick={() => onTransition(target)}
      disabled={isPending}
    >
      {label}
    </Button>
  );

  return (
    <div className="flex items-center gap-2">
      {s === "draft" && btn("Submit for Review", "pending_review")}
      {s === "pending_review" && (
        <>
          {btn("Approve Findings", "findings_approved")}
          <Button size="sm" variant="outline" onClick={onRevisionRequest} disabled={isPending}>
            Request Revision
          </Button>
        </>
      )}
      {s === "findings_approved" && (
        <>
          {btn("Approve Org Design", "org_approved")}
          <Button size="sm" variant="outline" onClick={onRevisionRequest} disabled={isPending}>
            Request Revision
          </Button>
        </>
      )}
      {s === "org_approved" && (
        <>
          {btn("Approve Provisioning", "provisioning_approved")}
          <Button size="sm" variant="outline" onClick={onRevisionRequest} disabled={isPending}>
            Request Revision
          </Button>
        </>
      )}
      {s === "revision_requested" && btn("Submit Revision", "pending_review")}
    </div>
  );
}

export function ProposalReviewPage() {
  const { programId } = useParams<{ programId: string }>();
  const queryClient = useQueryClient();
  const [revisionModalOpen, setRevisionModalOpen] = useState(false);
  const [revisionNotes, setRevisionNotes] = useState("");

  const { data: program } = useQuery({
    queryKey: ["onboarding-program", programId],
    queryFn: () => onboardingApi.getProgram(programId!),
    enabled: !!programId,
  });

  const { data: proposal, isLoading } = useQuery({
    queryKey: ["onboarding-proposal", programId],
    queryFn: () => onboardingApi.getProposal(programId!),
    enabled: !!programId,
  });

  const { data: history } = useQuery({
    queryKey: ["onboarding-proposal-history", programId],
    queryFn: () => onboardingApi.getProposalHistory(programId!),
    enabled: !!programId,
  });

  const generateMutation = useMutation({
    mutationFn: () => onboardingApi.generateProposal(programId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["onboarding-proposal", programId] });
      queryClient.invalidateQueries({ queryKey: ["onboarding-proposal-history", programId] });
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ status, notes }: { status: ProposalStatus; notes?: string }) =>
      onboardingApi.updateProposalStatus(programId!, proposal!.id, { status, revisionNotes: notes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["onboarding-proposal", programId] });
      queryClient.invalidateQueries({ queryKey: ["onboarding-proposal-history", programId] });
    },
  });

  const handleTransition = (status: ProposalStatus, notes?: string) => {
    statusMutation.mutate({ status, notes });
  };

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
            <h1 className="text-xl font-semibold">Org Design Review</h1>
            <p className="text-sm text-muted-foreground">
              {program?.title || "Setup Program"}
            </p>
          </div>
        </div>
        {!proposal && (
          <Button
            size="sm"
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
          >
            {generateMutation.isPending ? (
              <RefreshCw className="mr-1 h-3 w-3 animate-spin" />
            ) : (
              <FileText className="mr-1 h-3 w-3" />
            )}
            Generate Proposal
          </Button>
        )}
      </div>

      {generateMutation.isError && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {generateMutation.error instanceof Error ? generateMutation.error.message : "Failed to generate proposal"}
        </div>
      )}

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading proposal...</div>
      ) : !proposal ? (
        <div className="rounded-lg border border-border p-8 text-center">
          <FileText className="mx-auto h-8 w-8 text-muted-foreground/50" />
          <p className="mt-3 text-sm text-muted-foreground">
            No org design proposal generated yet. Complete the analysis step first, then generate a proposal.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Header with status and actions */}
          <div className="flex items-center justify-between rounded-lg border border-border p-4">
            <div className="flex items-center gap-3">
              <StatusBadge status={proposal.status as ProposalStatus} />
              <span className="text-xs text-muted-foreground">Version {proposal.version}</span>
            </div>
            <StatusActions
              proposal={proposal}
              onTransition={handleTransition}
              onRevisionRequest={() => setRevisionModalOpen(true)}
              isPending={statusMutation.isPending}
            />
          </div>

          {/* Key Findings */}
          {proposal.topFindings.length > 0 && (
            <div className="rounded-lg border border-border p-4">
              <h2 className="text-sm font-medium">Key Findings</h2>
              <ul className="mt-2 space-y-1">
                {proposal.topFindings.map((finding, i) => (
                  <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                    <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-foreground/40 shrink-0" />
                    {finding}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Hybrid Org Summary */}
          {proposal.hybridOrgSummary && (
            <div className="rounded-lg border border-border p-4">
              <h2 className="text-sm font-medium">Hybrid Team Design</h2>
              <p className="mt-2 text-sm text-muted-foreground whitespace-pre-line">
                {proposal.hybridOrgSummary}
              </p>
            </div>
          )}

          {/* Human Oversight Areas */}
          {proposal.humanLedBoundaries.length > 0 && (
            <div className="rounded-lg border border-border p-4">
              <h2 className="text-sm font-medium">Human Oversight Areas</h2>
              <ul className="mt-2 space-y-1">
                {proposal.humanLedBoundaries.map((boundary, i) => (
                  <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                    <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-orange-400 dark:bg-orange-500 shrink-0" />
                    {boundary}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Agent/Pairing/Rollout lists (IDs for now) */}
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-lg border border-border p-4">
              <h3 className="text-xs font-medium uppercase text-muted-foreground">Proposed Agents</h3>
              <p className="mt-1 text-lg font-semibold">{proposal.proposedAgentIds.length}</p>
            </div>
            <div className="rounded-lg border border-border p-4">
              <h3 className="text-xs font-medium uppercase text-muted-foreground">Pairings</h3>
              <p className="mt-1 text-lg font-semibold">{proposal.pairingIds.length}</p>
            </div>
            <div className="rounded-lg border border-border p-4">
              <h3 className="text-xs font-medium uppercase text-muted-foreground">Rollout Phases</h3>
              <p className="mt-1 text-lg font-semibold">{proposal.rolloutPhaseIds.length}</p>
            </div>
          </div>

          {/* Revision Notes History */}
          {proposal.revisionNotes.length > 0 && (
            <div className="rounded-lg border border-border p-4">
              <h2 className="text-sm font-medium">Revision Notes</h2>
              <ul className="mt-2 space-y-2">
                {proposal.revisionNotes.map((note, i) => (
                  <li key={i} className="rounded-md bg-muted/30 p-2 text-sm text-muted-foreground">
                    {note}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Version History */}
          {history && history.length > 1 && (
            <div className="rounded-lg border border-border p-4">
              <h2 className="text-sm font-medium">Version History</h2>
              <div className="mt-2 space-y-1">
                {history.map((h) => (
                  <div key={h.id} className="flex items-center gap-3 text-sm text-muted-foreground">
                    <span>v{h.version}</span>
                    <StatusBadge status={h.status as ProposalStatus} />
                    <span className="text-xs">{new Date(h.createdAt).toLocaleDateString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

          {/* Revision Notes Modal */}
          {revisionModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
              <div className="w-full max-w-md rounded-lg border border-border bg-background p-6 shadow-lg">
                <h3 className="text-sm font-semibold">Request Revision</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Describe what changes are needed before this can be approved.
                </p>
                <textarea
                  className="mt-3 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  rows={4}
                  placeholder="e.g., The proposed agent count seems too high for the pilot phase..."
                  value={revisionNotes}
                  onChange={(e) => setRevisionNotes(e.target.value)}
                  autoFocus
                />
                <div className="mt-4 flex justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setRevisionModalOpen(false);
                      setRevisionNotes("");
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    disabled={!revisionNotes.trim() || statusMutation.isPending}
                    onClick={() => {
                      handleTransition("revision_requested", revisionNotes.trim());
                      setRevisionModalOpen(false);
                      setRevisionNotes("");
                    }}
                  >
                    Submit Revision Request
                  </Button>
                </div>
              </div>
            </div>
          )}
    </div>
  );
}
