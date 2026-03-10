import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@/lib/router";
import { Plus, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCompany } from "../context/CompanyContext";
import { onboardingApi } from "../api/onboarding";
import type { OnboardingProgramSummary } from "@paperclipai/shared";

export function OnboardingDashboard() {
  const { selectedCompanyId } = useCompany();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: programs, isLoading } = useQuery({
    queryKey: ["onboarding-programs", selectedCompanyId],
    queryFn: () => onboardingApi.listPrograms(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const createMutation = useMutation({
    mutationFn: () => onboardingApi.createProgram({ companyId: selectedCompanyId! }),
    onSuccess: (program) => {
      queryClient.invalidateQueries({ queryKey: ["onboarding-programs"] });
      navigate(`/onboarding/${program.id}`);
    },
  });

  if (isLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Onboarding Programs</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Human-AI alignment discovery and proposal programs
          </p>
        </div>
        <Button
          onClick={() => createMutation.mutate()}
          disabled={createMutation.isPending}
          size="sm"
        >
          <Plus className="h-4 w-4 mr-1.5" />
          New Program
        </Button>
      </div>

      {(!programs || programs.length === 0) ? (
        <div className="rounded-lg border border-dashed border-border p-12 text-center">
          <ClipboardList className="h-10 w-10 mx-auto text-muted-foreground/50" />
          <p className="mt-3 text-sm text-muted-foreground">No onboarding programs yet</p>
          <p className="mt-1 text-xs text-muted-foreground/70">
            Create a program to start the human-AI alignment discovery process
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {programs.map((p: OnboardingProgramSummary) => (
            <Link
              key={p.id}
              to={`/onboarding/${p.id}`}
              className="block rounded-lg border border-border p-4 hover:bg-accent/30 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium">{p.title || "Untitled Program"}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Phase: {p.phase.replace(/_/g, " ")} · Status: {p.status}
                  </p>
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span>{p.participantCount} participants</span>
                  <span>{p.completedParticipantCount} completed</span>
                  {p.hasIntake && <span className="text-green-600">Intake done</span>}
                  {p.hasSynthesis && <span className="text-blue-600">Synthesis ready</span>}
                  {p.hasProposal && <span className="text-purple-600">Proposal ready</span>}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
