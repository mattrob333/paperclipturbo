import {
  ArrowRight,
  ArrowUp,
  CheckCircle2,
  Shield,
  Users,
  GitFork,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { AgentCognitiveData, DelegationPolicy, OwnershipMode } from "@paperclipai/shared";

interface DelegationTabProps {
  cognitiveData: AgentCognitiveData;
}

const ownershipBadge: Record<OwnershipMode, { className: string; label: string; icon: typeof ArrowRight }> = {
  owns: {
    className: "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300",
    label: "Owns",
    icon: Shield,
  },
  delegates: {
    className: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",
    label: "Delegates",
    icon: ArrowRight,
  },
  escalates: {
    className: "bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300",
    label: "Escalates",
    icon: ArrowUp,
  },
  collaborates: {
    className: "bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300",
    label: "Collaborates",
    icon: Users,
  },
};

export function DelegationTab({ cognitiveData }: DelegationTabProps) {
  const { delegationPolicies } = cognitiveData;

  if (delegationPolicies.length === 0) {
    return <p className="text-sm text-muted-foreground">No delegation policies configured.</p>;
  }

  // Collect unique collaborators
  const collaborators = new Set<string>();
  delegationPolicies.forEach((p) => {
    if (p.delegateTo) collaborators.add(p.delegateTo);
    if (p.escalateTo) collaborators.add(p.escalateTo);
  });

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex flex-wrap gap-2">
        <Badge variant="outline" className="text-xs gap-1">
          <GitFork className="h-3 w-3" />
          {delegationPolicies.length} policies
        </Badge>
        <Badge variant="outline" className="text-xs gap-1">
          <Users className="h-3 w-3" />
          {collaborators.size} collaborators
        </Badge>
        {delegationPolicies.filter((p) => p.approvalRequired).length > 0 && (
          <Badge variant="outline" className="text-xs gap-1 text-yellow-700 dark:text-yellow-400">
            {delegationPolicies.filter((p) => p.approvalRequired).length} require approval
          </Badge>
        )}
      </div>

      {/* Delegation matrix table */}
      <div className="border border-border rounded-lg overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border bg-accent/20">
              <th className="text-left px-3 py-2 font-medium text-muted-foreground whitespace-nowrap">Task Class</th>
              <th className="text-left px-3 py-2 font-medium text-muted-foreground whitespace-nowrap">Ownership</th>
              <th className="text-left px-3 py-2 font-medium text-muted-foreground whitespace-nowrap">Delegate To</th>
              <th className="text-left px-3 py-2 font-medium text-muted-foreground whitespace-nowrap">Escalate To</th>
              <th className="text-center px-3 py-2 font-medium text-muted-foreground whitespace-nowrap">Approval</th>
              <th className="text-left px-3 py-2 font-medium text-muted-foreground whitespace-nowrap">Confidence</th>
              <th className="text-left px-3 py-2 font-medium text-muted-foreground whitespace-nowrap">Notes</th>
            </tr>
          </thead>
          <tbody>
            {delegationPolicies.map((policy) => {
              const ownership = ownershipBadge[policy.ownershipMode];
              const OwnerIcon = ownership.icon;
              return (
                <tr key={policy.id} className="border-b border-border last:border-b-0">
                  <td className="px-3 py-2.5">
                    <span className="text-xs font-medium">
                      {policy.taskClass.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
                      ownership.className
                    )}>
                      <OwnerIcon className="h-2.5 w-2.5" />
                      {ownership.label}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    {policy.delegateTo ? (
                      <span className="text-xs font-mono">{policy.delegateTo}</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    {policy.escalateTo ? (
                      <span className="text-xs font-mono">{policy.escalateTo}</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    {policy.approvalRequired ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-yellow-600 dark:text-yellow-400 inline" />
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <Badge variant="outline" className="text-[10px]">{policy.confidenceThreshold}</Badge>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="text-[11px] text-muted-foreground">{policy.notes || "-"}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Collaborator list */}
      {collaborators.size > 0 && (
        <div className="border border-border rounded-lg p-4 space-y-3">
          <h3 className="text-sm font-medium flex items-center gap-2">
            <Users className="h-3.5 w-3.5 text-muted-foreground" />
            Collaboration Partners
          </h3>
          <div className="flex flex-wrap gap-2">
            {Array.from(collaborators).map((id) => (
              <Badge key={id} variant="secondary" className="text-[11px] font-mono">
                {id}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
