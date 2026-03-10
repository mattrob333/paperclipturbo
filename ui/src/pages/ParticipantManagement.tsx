import { useState } from "react";
import { Link, useParams } from "@/lib/router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Plus, Trash2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { onboardingApi } from "../api/onboarding";
import type { OnboardingParticipant } from "@paperclipai/shared";

export function ParticipantManagement() {
  const { programId } = useParams<{ programId: string }>();
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newDept, setNewDept] = useState("");

  const { data: participants, isLoading } = useQuery({
    queryKey: ["onboarding-participants", programId],
    queryFn: () => onboardingApi.listParticipants(programId!),
    enabled: !!programId,
  });

  const addMutation = useMutation({
    mutationFn: () =>
      onboardingApi.addParticipant(programId!, {
        name: newName,
        email: newEmail,
        title: newTitle || undefined,
        department: newDept || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["onboarding-participants", programId] });
    },
  });

  const removeMutation = useMutation({
    mutationFn: (participantId: string) =>
      onboardingApi.removeParticipant(programId!, participantId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["onboarding-participants", programId] });
    },
  });

  if (isLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading...</div>;
  }

  const participantCount = participants?.length ?? 0;
  const hasParticipants = participantCount > 0;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-3">
          <Link to={`/onboarding/${programId}`}>
            <Button variant="ghost" size="sm" className="-ml-2">
              <ArrowLeft className="h-4 w-4 mr-1.5" />
              Back to Setup Journey
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-semibold">Team Setup</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Add the stakeholders who should receive discovery interviews. Once your team is in place, move on to interviews so each person can answer their own questions.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasParticipants && (
            <Link to={`/onboarding/${programId}`}>
              <Button variant="outline" size="sm">
                Continue to Interviews
                <ArrowRight className="h-4 w-4 ml-1.5" />
              </Button>
            </Link>
          )}
          <Button size="sm" onClick={() => setShowAdd(true)}>
            <UserPlus className="h-4 w-4 mr-1.5" />
            Add Participant
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-muted/20 p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium">What happens next</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Team Setup comes before Team Interviews. Add names, roles, and emails here, then begin the interview step from the setup journey to collect each participant's responses.
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Participants</p>
            <p className="mt-1 text-lg font-semibold">{participantCount}</p>
          </div>
        </div>
      </div>

      {showAdd && (
        <div className="rounded-lg border border-border p-4 space-y-3">
          <h3 className="text-sm font-medium">Add Participant</h3>
          <div className="grid grid-cols-2 gap-3">
            <input
              className="rounded-md border border-border bg-background px-3 py-2 text-sm"
              placeholder="Name *"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <input
              className="rounded-md border border-border bg-background px-3 py-2 text-sm"
              placeholder="Email *"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
            />
            <input
              className="rounded-md border border-border bg-background px-3 py-2 text-sm"
              placeholder="Title"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
            />
            <input
              className="rounded-md border border-border bg-background px-3 py-2 text-sm"
              placeholder="Department"
              value={newDept}
              onChange={(e) => setNewDept(e.target.value)}
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => setShowAdd(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => addMutation.mutate()}
              disabled={!newName || !newEmail || addMutation.isPending}
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add
            </Button>
          </div>
        </div>
      )}

      {(!participants || participants.length === 0) ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <p className="text-sm text-muted-foreground">No team members added yet. Add participants to begin the interview process.</p>
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Name</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Email</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Title</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Department</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-2 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {participants.map((p: OnboardingParticipant) => (
                <tr key={p.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-2.5 font-medium">{p.name}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{p.email}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{p.title || "\u2014"}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{p.department || "\u2014"}</td>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      p.status === "completed" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
                      p.status === "active" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" :
                      p.status === "declined" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" :
                      "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400"
                    }`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    {confirmDelete === p.id ? (
                      <div className="flex items-center gap-1">
                        <Button
                          variant="destructive"
                          size="icon-sm"
                          onClick={() => {
                            removeMutation.mutate(p.id);
                            setConfirmDelete(null);
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setConfirmDelete(null)}
                        >
                          <span className="text-xs">&times;</span>
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setConfirmDelete(p.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center justify-between border-t border-border pt-4">
        <Link to={`/onboarding/${programId}`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Back to Setup Journey
          </Button>
        </Link>
        <Link to={`/onboarding/${programId}`}>
          <Button size="sm" disabled={!hasParticipants}>
            Begin Interviews
            <ArrowRight className="h-4 w-4 ml-1.5" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
