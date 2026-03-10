import { useState, useEffect } from "react";
import { useParams, useNavigate } from "@/lib/router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { onboardingApi } from "../api/onboarding";
import type { DeploymentPace, RiskTolerance } from "@paperclipai/shared";

export function SponsorIntakePage() {
  const { programId } = useParams<{ programId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: program } = useQuery({
    queryKey: ["onboarding-program", programId],
    queryFn: () => onboardingApi.getProgram(programId!),
    enabled: !!programId,
  });

  const { data: existingIntake } = useQuery({
    queryKey: ["sponsor-intake", programId],
    queryFn: () => onboardingApi.getIntake(programId!).catch(() => null),
    enabled: !!programId,
  });

  const isEdit = !!existingIntake;

  const [form, setForm] = useState({
    sponsorName: "",
    sponsorRole: "",
    currentPriorities: "",
    targetDepartments: "",
    deploymentPace: "" as DeploymentPace | "",
    riskTolerance: "" as RiskTolerance | "",
    desiredOutcomes: "",
    nonGoals: "",
    notes: "",
  });

  useEffect(() => {
    if (existingIntake) {
      setForm({
        sponsorName: existingIntake.sponsorName,
        sponsorRole: existingIntake.sponsorRole,
        currentPriorities: existingIntake.currentPriorities.join("\n"),
        targetDepartments: existingIntake.targetDepartments.join("\n"),
        deploymentPace: (existingIntake.deploymentPace ?? "") as DeploymentPace | "",
        riskTolerance: (existingIntake.riskTolerance ?? "") as RiskTolerance | "",
        desiredOutcomes: existingIntake.desiredOutcomes.join("\n"),
        nonGoals: existingIntake.nonGoals.join("\n"),
        notes: existingIntake.notes ?? "",
      });
    }
  }, [existingIntake]);

  const createMutation = useMutation({
    mutationFn: () =>
      onboardingApi.createIntake(programId!, {
        sponsorName: form.sponsorName,
        sponsorRole: form.sponsorRole,
        currentPriorities: form.currentPriorities.split("\n").filter(Boolean),
        targetDepartments: form.targetDepartments.split("\n").filter(Boolean),
        currentAiUsage: [],
        deploymentPace: form.deploymentPace || undefined,
        riskTolerance: form.riskTolerance || undefined,
        desiredOutcomes: form.desiredOutcomes.split("\n").filter(Boolean),
        nonGoals: form.nonGoals.split("\n").filter(Boolean),
        notes: form.notes || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["onboarding-programs"] });
      navigate(`/onboarding/${programId}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      onboardingApi.updateIntake(programId!, {
        sponsorName: form.sponsorName,
        sponsorRole: form.sponsorRole,
        currentPriorities: form.currentPriorities.split("\n").filter(Boolean),
        targetDepartments: form.targetDepartments.split("\n").filter(Boolean),
        deploymentPace: form.deploymentPace || undefined,
        riskTolerance: form.riskTolerance || undefined,
        desiredOutcomes: form.desiredOutcomes.split("\n").filter(Boolean),
        nonGoals: form.nonGoals.split("\n").filter(Boolean),
        notes: form.notes || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["onboarding-programs"] });
      queryClient.invalidateQueries({ queryKey: ["sponsor-intake", programId] });
      navigate(`/onboarding/${programId}`);
    },
  });

  const activeMutation = isEdit ? updateMutation : createMutation;

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon-sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-xl font-semibold">{isEdit ? "Edit Executive Goals" : "Executive Goals"}</h1>
          <p className="text-sm text-muted-foreground">
            {program?.title || "Setup Program"}
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Sponsor Name *</label>
            <input
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              placeholder="e.g., Jane Smith"
              value={form.sponsorName}
              onChange={(e) => update("sponsorName", e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Sponsor Role *</label>
            <input
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              placeholder="e.g., VP of Operations"
              value={form.sponsorRole}
              onChange={(e) => update("sponsorRole", e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Deployment Pace</label>
            <p className="text-xs text-muted-foreground mt-0.5 mb-1">How quickly do you want to roll out AI agents?</p>
            <select
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={form.deploymentPace}
              onChange={(e) => update("deploymentPace", e.target.value)}
            >
              <option value="">Select...</option>
              <option value="aggressive">Aggressive</option>
              <option value="moderate">Moderate</option>
              <option value="conservative">Conservative</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Risk Tolerance</label>
            <p className="text-xs text-muted-foreground mt-0.5 mb-1">How comfortable is the organization with AI autonomy?</p>
            <select
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={form.riskTolerance}
              onChange={(e) => update("riskTolerance", e.target.value)}
            >
              <option value="">Select...</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground">Current Priorities (one per line)</label>
          <p className="text-xs text-muted-foreground mt-0.5 mb-1">What are the top strategic priorities driving this initiative?</p>
          <textarea
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            rows={3}
            placeholder={"e.g., Reduce manual data entry by 40%\nAutomate weekly reporting"}
            value={form.currentPriorities}
            onChange={(e) => update("currentPriorities", e.target.value)}
          />
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground">Target Departments (one per line)</label>
          <p className="text-xs text-muted-foreground mt-0.5 mb-1">Which departments or teams should be included in the pilot?</p>
          <textarea
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            rows={3}
            placeholder={"e.g., Marketing\nCustomer Support\nOperations"}
            value={form.targetDepartments}
            onChange={(e) => update("targetDepartments", e.target.value)}
          />
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground">Desired Outcomes (one per line)</label>
          <p className="text-xs text-muted-foreground mt-0.5 mb-1">What measurable results do you expect from the pilot?</p>
          <textarea
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            rows={3}
            placeholder={"e.g., Free up 10 hours/week per team member\nImprove response time to under 2 hours"}
            value={form.desiredOutcomes}
            onChange={(e) => update("desiredOutcomes", e.target.value)}
          />
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground">Non-Goals (one per line)</label>
          <p className="text-xs text-muted-foreground mt-0.5 mb-1">What should AI agents explicitly not do?</p>
          <textarea
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            rows={3}
            placeholder={"e.g., Replace customer-facing roles\nAutomate hiring decisions"}
            value={form.nonGoals}
            onChange={(e) => update("nonGoals", e.target.value)}
          />
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground">Notes</label>
          <textarea
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            rows={3}
            placeholder="Any additional context or constraints..."
            value={form.notes}
            onChange={(e) => update("notes", e.target.value)}
          />
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Button variant="outline" onClick={() => navigate(-1)}>Cancel</Button>
          <Button
            onClick={() => activeMutation.mutate()}
            disabled={!form.sponsorName || !form.sponsorRole || activeMutation.isPending}
          >
            {activeMutation.isPending ? "Saving..." : isEdit ? "Update & Continue" : "Save & Continue"}
          </Button>
        </div>
      </div>
    </div>
  );
}
