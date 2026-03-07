import {
  Play,
  Wrench,
  Users,
  Eye,
  AlertTriangle,
  GitBranch,
  Star,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useState } from "react";
import type { AgentCognitiveData, SkillChain, SkillChainStepType } from "@paperclipai/shared";

interface SkillChainsTabProps {
  cognitiveData: AgentCognitiveData;
}

const stepTypeConfig: Record<SkillChainStepType, { icon: typeof Play; color: string; bg: string; label: string }> = {
  action: { icon: Play, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-100 dark:bg-blue-900/50", label: "Action" },
  tool_call: { icon: Wrench, color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-100 dark:bg-purple-900/50", label: "Tool Call" },
  delegation: { icon: Users, color: "text-cyan-600 dark:text-cyan-400", bg: "bg-cyan-100 dark:bg-cyan-900/50", label: "Delegation" },
  review: { icon: Eye, color: "text-green-600 dark:text-green-400", bg: "bg-green-100 dark:bg-green-900/50", label: "Review" },
  escalation: { icon: AlertTriangle, color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-100 dark:bg-orange-900/50", label: "Escalation" },
  decision: { icon: GitBranch, color: "text-yellow-600 dark:text-yellow-400", bg: "bg-yellow-100 dark:bg-yellow-900/50", label: "Decision" },
};

function ChainCard({ chain }: { chain: SkillChain }) {
  const [expanded, setExpanded] = useState(chain.isPrimary);

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      {/* Chain header */}
      <button
        className="flex items-center gap-3 w-full px-4 py-3 text-left hover:bg-accent/20 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium truncate">{chain.name}</span>
            {chain.isPrimary && (
              <Badge variant="default" className="text-[10px] gap-0.5">
                <Star className="h-2.5 w-2.5" />
                Primary
              </Badge>
            )}
            <Badge variant="outline" className="text-[10px]">v{chain.version}</Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{chain.description}</p>
        </div>
        <span className="text-xs text-muted-foreground shrink-0">{chain.steps.length} steps</span>
      </button>

      {expanded && (
        <div className="border-t border-border px-4 py-3 space-y-4">
          {/* Start conditions */}
          {chain.startConditions.length > 0 && (
            <div className="space-y-1">
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Start Conditions</span>
              <div className="flex flex-wrap gap-1.5">
                {chain.startConditions.map((cond, i) => (
                  <Badge key={i} variant="outline" className="text-[11px]">{cond}</Badge>
                ))}
              </div>
            </div>
          )}

          {/* Steps - vertical flow */}
          <div className="space-y-0">
            {chain.steps
              .sort((a, b) => a.orderIndex - b.orderIndex)
              .map((step, i) => {
                const config = stepTypeConfig[step.type];
                const StepIcon = config.icon;

                return (
                  <div key={step.id} className="flex gap-3">
                    {/* Connector line + icon */}
                    <div className="flex flex-col items-center">
                      <div className={cn("flex items-center justify-center h-7 w-7 rounded-full shrink-0", config.bg)}>
                        <StepIcon className={cn("h-3.5 w-3.5", config.color)} />
                      </div>
                      {i < chain.steps.length - 1 && (
                        <div className="w-px flex-1 bg-border min-h-[16px]" />
                      )}
                    </div>

                    {/* Step content */}
                    <div className="flex-1 min-w-0 pb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium">{step.title}</span>
                        <Badge variant="secondary" className="text-[10px]">{config.label}</Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{step.description}</p>

                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5">
                        {step.toolRequired && (
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <Wrench className="h-2.5 w-2.5" /> {step.toolRequired}
                          </span>
                        )}
                        {step.delegateTarget && (
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <Users className="h-2.5 w-2.5" /> {step.delegateTarget}
                          </span>
                        )}
                        {step.escalationTarget && (
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <AlertTriangle className="h-2.5 w-2.5" /> Escalates to {step.escalationTarget}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                        <span className="text-[10px] flex items-center gap-1">
                          <CheckCircle2 className="h-2.5 w-2.5 text-green-600 dark:text-green-400" />
                          <span className="text-muted-foreground">{step.successCondition}</span>
                        </span>
                        <span className="text-[10px] flex items-center gap-1">
                          <XCircle className="h-2.5 w-2.5 text-red-600 dark:text-red-400" />
                          <span className="text-muted-foreground">{step.failureCondition}</span>
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>

          {/* Completion criteria */}
          <div className="border-t border-border pt-3 space-y-2">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
              <div>
                <span className="text-[11px] font-medium text-muted-foreground">Completion:</span>
                <span className="text-xs text-muted-foreground ml-1">{chain.completionCriteria}</span>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-3.5 w-3.5 text-orange-600 dark:text-orange-400 mt-0.5 shrink-0" />
              <div>
                <span className="text-[11px] font-medium text-muted-foreground">Fallback:</span>
                <span className="text-xs text-muted-foreground ml-1">{chain.fallbackBehavior}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function SkillChainsTab({ cognitiveData }: SkillChainsTabProps) {
  const { skillChains } = cognitiveData;

  if (skillChains.length === 0) {
    return <p className="text-sm text-muted-foreground">No skill chains configured.</p>;
  }

  // Sort primary chains first
  const sorted = [...skillChains].sort((a, b) => (b.isPrimary ? 1 : 0) - (a.isPrimary ? 1 : 0));

  return (
    <div className="space-y-3">
      {sorted.map((chain) => (
        <ChainCard key={chain.id} chain={chain} />
      ))}
    </div>
  );
}
