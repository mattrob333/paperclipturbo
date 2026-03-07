import {
  Target,
  ListOrdered,
  BookOpen,
  ArrowDownUp,
  AlertTriangle,
  ShieldAlert,
  Fence,
  Gauge,
  HelpCircle,
  Brain,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { AgentCognitiveData } from "@paperclipai/shared";

interface CognitiveOSTabProps {
  cognitiveData: AgentCognitiveData;
}

function Section({ icon: Icon, title, children }: { icon: typeof Target; title: string; children: React.ReactNode }) {
  return (
    <div className="border border-border rounded-lg p-4 space-y-3">
      <h3 className="text-sm font-medium flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        {title}
      </h3>
      {children}
    </div>
  );
}

function RuleList({ items, variant = "default" }: { items: string[]; variant?: "default" | "warning" | "danger" }) {
  const dotColors = {
    default: "bg-blue-500",
    warning: "bg-yellow-500",
    danger: "bg-red-500",
  };
  return (
    <div className="space-y-1.5">
      {items.map((item, i) => (
        <div key={i} className="flex items-start gap-2">
          <span className={`h-1.5 w-1.5 rounded-full mt-1.5 shrink-0 ${dotColors[variant]}`} />
          <span className="text-xs text-muted-foreground">{item}</span>
        </div>
      ))}
    </div>
  );
}

export function CognitiveOSTab({ cognitiveData }: CognitiveOSTabProps) {
  const { profile } = cognitiveData;

  return (
    <div className="space-y-4">
      {/* Identity & Mission */}
      <Section icon={Brain} title="Identity & Mission">
        <p className="text-sm text-muted-foreground">{profile.mission}</p>
        <div className="flex flex-wrap gap-2 pt-1">
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-muted-foreground">Role:</span>
            <span className="font-medium">{profile.cognitiveRole}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-muted-foreground">Specialization:</span>
            <span className="font-medium">{profile.specialization}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5 pt-1">
          {profile.capabilityTags.map((tag) => (
            <Badge key={tag} variant="secondary" className="text-[11px]">{tag}</Badge>
          ))}
        </div>
      </Section>

      {/* Priority Stack */}
      <Section icon={ListOrdered} title="Priority Stack">
        <div className="space-y-1.5">
          {profile.priorityStack.map((item, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="shrink-0 flex items-center justify-center h-5 w-5 rounded bg-accent text-[10px] font-bold text-muted-foreground">
                {i + 1}
              </span>
              <span className="text-xs text-muted-foreground pt-0.5">{item}</span>
            </div>
          ))}
        </div>
      </Section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Decision Rules */}
        <Section icon={BookOpen} title="Decision Rules">
          <RuleList items={profile.decisionRules} />
        </Section>

        {/* Reasoning Sequence */}
        <Section icon={ArrowDownUp} title="Reasoning Sequence">
          <div className="space-y-0">
            {profile.reasoningSequence.map((step, i) => (
              <div key={i} className="flex items-start gap-2">
                <div className="flex flex-col items-center">
                  <span className="flex items-center justify-center h-5 w-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold shrink-0">
                    {i + 1}
                  </span>
                  {i < profile.reasoningSequence.length - 1 && (
                    <span className="w-px h-4 bg-border" />
                  )}
                </div>
                <span className="text-xs text-muted-foreground pt-0.5">{step}</span>
              </div>
            ))}
          </div>
        </Section>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Escalation Triggers */}
        <Section icon={AlertTriangle} title="Escalation Triggers">
          <RuleList items={profile.escalationTriggers} variant="warning" />
        </Section>

        {/* Anti-Patterns */}
        <Section icon={ShieldAlert} title="Anti-Patterns">
          <RuleList items={profile.antiPatterns} variant="danger" />
        </Section>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Boundary Rules */}
        <Section icon={Fence} title="Boundary Rules">
          <RuleList items={profile.boundaryRules} />
        </Section>

        {/* Confidence Policy & Edge Cases */}
        <div className="space-y-4">
          <Section icon={Gauge} title="Confidence Policy">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">{profile.confidencePolicy}</Badge>
              <span className="text-xs text-muted-foreground">
                {profile.confidencePolicy === "high"
                  ? "Operates autonomously with high confidence"
                  : profile.confidencePolicy === "medium"
                  ? "Requires occasional verification"
                  : "Frequently escalates for review"}
              </span>
            </div>
          </Section>

          {profile.edgeCaseRules.length > 0 && (
            <Section icon={HelpCircle} title="Edge Cases">
              <RuleList items={profile.edgeCaseRules} variant="warning" />
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}
