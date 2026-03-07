import { cn } from "../lib/utils";
import type { AgentSetupState } from "@paperclipai/shared";

const setupStateBadgeStyles: Record<AgentSetupState, string> = {
  not_configured: "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400",
  credentials_missing: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300",
  environment_test_failed: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300",
  configured_unverified: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300",
  verified: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",
  runtime_unavailable: "bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300",
  healthy: "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300",
};

const setupStateLabels: Record<AgentSetupState, string> = {
  not_configured: "Not Configured",
  credentials_missing: "Creds Missing",
  environment_test_failed: "Env Failed",
  configured_unverified: "Unverified",
  verified: "Verified",
  runtime_unavailable: "Unavailable",
  healthy: "Healthy",
};

export function AgentSetupBadge({
  state,
  className,
}: {
  state: AgentSetupState;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium whitespace-nowrap shrink-0",
        setupStateBadgeStyles[state],
        className,
      )}
      title={setupStateLabels[state]}
    >
      {setupStateLabels[state]}
    </span>
  );
}
