import { useCallback, useMemo, useRef, useState, useEffect } from "react";
import {
  ChevronUp,
  ChevronDown,
  Send,
  Bot,
  Loader2,
  Activity,
  Play,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Circle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useDeveloperMode } from "@/context/DeveloperModeContext";
import { useCompany } from "@/context/CompanyContext";
import { useAgentRuntime, useAgentValidation } from "@/hooks/useRuntime";
import { agentsApi } from "@/api/agents";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DockStatus =
  | "no_agent"
  | "credentials_missing"
  | "runtime_offline"
  | "workspace_unavailable"
  | "ready"
  | "action_in_progress";

interface DockMessage {
  id: string;
  role: "system" | "result";
  content: string;
  variant: "info" | "success" | "error";
  timestamp: Date;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MIN_DOCK_HEIGHT = 140;
const MAX_DOCK_HEIGHT = 520;
const CLOSED_DOCK_HEIGHT = 36;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let messageIdCounter = 0;
function nextId() {
  return `msg-${++messageIdCounter}`;
}

function formatTime(d: Date) {
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function isHeartbeatStale(lastAt: string | null | undefined): boolean {
  if (!lastAt) return true;
  return Date.now() - new Date(lastAt).getTime() > 60 * 60 * 1000; // >1 hour
}

// ---------------------------------------------------------------------------
// Status derivation
// ---------------------------------------------------------------------------

function deriveStatus(
  selectedAgent: string | null,
  actionInProgress: boolean,
  runtimeData: ReturnType<typeof useAgentRuntime>["data"],
  runtimeError: unknown,
  validationData: ReturnType<typeof useAgentValidation>["data"],
  workspaceRoot: string | null,
  workspaceError: string | null,
): DockStatus {
  if (!selectedAgent) return "no_agent";
  if (actionInProgress) return "action_in_progress";

  // Check for credential errors in validation data
  if (validationData) {
    const hasCredentialError = validationData.some(
      (v) =>
        v.severity === "error" &&
        (v.rule.includes("credential") ||
          v.message.toLowerCase().includes("api key") ||
          v.message.toLowerCase().includes("credential")),
    );
    if (hasCredentialError) return "credentials_missing";
  }

  if (runtimeError) return "runtime_offline";
  if (workspaceError) return "workspace_unavailable";
  if (runtimeData) return "ready";
  return "ready";
}

const STATUS_CONFIG: Record<DockStatus, { color: string; label: string; dotClass: string }> = {
  no_agent: {
    color: "text-[hsl(220,13%,45%)]",
    label: "Select an agent",
    dotClass: "bg-[hsl(220,13%,35%)]",
  },
  credentials_missing: {
    color: "text-amber-400",
    label: "Credentials Missing",
    dotClass: "bg-amber-400",
  },
  runtime_offline: {
    color: "text-red-400",
    label: "Runtime Offline",
    dotClass: "bg-red-400",
  },
  workspace_unavailable: {
    color: "text-orange-400",
    label: "No Workspace Configured",
    dotClass: "bg-orange-400",
  },
  ready: {
    color: "text-green-400",
    label: "Ready",
    dotClass: "bg-green-400",
  },
  action_in_progress: {
    color: "text-blue-400",
    label: "Running...",
    dotClass: "bg-blue-400",
  },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ClaudeDock() {
  const {
    claudeDockOpen,
    claudeDockHeight,
    toggleClaudeDock,
    setClaudeDockHeight,
    activeFile,
    selectedAgent,
    workspaceRoot,
    workspaceError,
  } = useDeveloperMode();

  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id ?? null;
  const queryClient = useQueryClient();

  const { data: runtimeData, error: runtimeError } = useAgentRuntime(selectedAgent);
  const { data: validationData } = useAgentValidation(selectedAgent);

  const [messages, setMessages] = useState<DockMessage[]>([]);
  const [actionInProgress, setActionInProgress] = useState(false);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastIntroAgentRef = useRef<string | null>(null);

  // Derive status
  const status = deriveStatus(
    selectedAgent,
    actionInProgress,
    runtimeData,
    runtimeError,
    validationData,
    workspaceRoot,
    workspaceError,
  );
  const statusCfg = STATUS_CONFIG[status];

  // Scroll messages to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // Build welcome / context messages when agent or runtime data changes
  useEffect(() => {
    if (!selectedAgent) {
      lastIntroAgentRef.current = null;
      setMessages([
        {
          id: nextId(),
          role: "system",
          content: "No agent selected. Choose an agent from the file tree or developer mode toolbar to get started.",
          variant: "info",
          timestamp: new Date(),
        },
      ]);
      return;
    }

    const shouldResetMessages = lastIntroAgentRef.current !== selectedAgent;
    if (!shouldResetMessages && messages.length > 0) {
      return;
    }

    lastIntroAgentRef.current = selectedAgent;

    const introMessages: DockMessage[] = [];

    if (runtimeData) {
      const parts: string[] = [];
      parts.push(`Agent runtime: ${runtimeData.adapter} adapter`);
      if (runtimeData.model) parts.push(`Model: ${runtimeData.model}`);
      parts.push(`Environment: ${runtimeData.environmentStatus}`);
      if (runtimeData.lastHeartbeatAt) {
        parts.push(`Last heartbeat: ${timeAgo(runtimeData.lastHeartbeatAt)}`);
      }
      if (runtimeData.sessionState) {
        parts.push(`Session: ${runtimeData.sessionState.status}${runtimeData.sessionState.taskKey ? ` (${runtimeData.sessionState.taskKey})` : ""}`);
      }
      introMessages.push({
        id: nextId(),
        role: "system",
        content: parts.join("\n"),
        variant: "info",
        timestamp: new Date(),
      });
    }

    if (validationData && validationData.length > 0) {
      const errors = validationData.filter((v) => v.severity === "error").length;
      const warnings = validationData.filter((v) => v.severity === "warning").length;
      const parts: string[] = [];
      if (errors > 0) parts.push(`${errors} error${errors !== 1 ? "s" : ""}`);
      if (warnings > 0) parts.push(`${warnings} warning${warnings !== 1 ? "s" : ""}`);
      introMessages.push({
        id: nextId(),
        role: "system",
        content: `Validation: ${parts.join(", ")}`,
        variant: errors > 0 ? "error" : "info",
        timestamp: new Date(),
      });
    } else if (validationData && validationData.length === 0) {
      introMessages.push({
        id: nextId(),
        role: "system",
        content: "Validation: All checks passed",
        variant: "success",
        timestamp: new Date(),
      });
    }

    if (introMessages.length > 0) {
      setMessages(introMessages);
    }
    // Only re-run when we get new data for a different agent or data shape changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length, selectedAgent, runtimeData?.adapter, runtimeData?.lastHeartbeatAt, validationData?.length]);

  // ------- Action helpers -------

  const appendResult = useCallback((content: string, variant: "success" | "error" | "info") => {
    setMessages((prev) => [
      ...prev,
      { id: nextId(), role: "result", content, variant, timestamp: new Date() },
    ]);
  }, []);

  const invalidateRuntime = useCallback(() => {
    if (!companyId || !selectedAgent) return;
    queryClient.invalidateQueries({ queryKey: ["agent-runtime", companyId, selectedAgent] });
    queryClient.invalidateQueries({ queryKey: ["agent-validation", companyId, selectedAgent] });
  }, [queryClient, companyId, selectedAgent]);

  const runAction = useCallback(
    async (label: string, fn: () => Promise<string>) => {
      setActionInProgress(true);
      try {
        const result = await fn();
        appendResult(result, "success");
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        appendResult(`${label} failed: ${msg}`, "error");
      } finally {
        setActionInProgress(false);
        invalidateRuntime();
      }
    },
    [appendResult, invalidateRuntime],
  );

  // ------- Dock actions -------

  const handleInvokeHeartbeat = useCallback(() => {
    if (!selectedAgent || !companyId) return;
    runAction("Invoke Heartbeat", async () => {
      const run = await agentsApi.invoke(selectedAgent, companyId);
      return `Heartbeat invoked successfully (run ${run.id})`;
    });
  }, [selectedAgent, companyId, runAction]);

  const handleResetSession = useCallback(() => {
    if (!selectedAgent || !companyId) return;
    runAction("Reset Session", async () => {
      await agentsApi.resetSession(selectedAgent, null, companyId);
      return "Session reset complete";
    });
  }, [selectedAgent, companyId, runAction]);

  const handleWakeup = useCallback(() => {
    if (!selectedAgent || !companyId) return;
    runAction("Wake Agent", async () => {
      const result = await agentsApi.wakeup(
        selectedAgent,
        { source: "on_demand", triggerDetail: "manual", reason: "Manual wakeup from dock" },
        companyId,
      );
      if ("status" in result && result.status === "skipped") {
        return "Wakeup skipped (agent already active)";
      }
      return `Agent wakeup triggered (run ${(result as { id: string }).id})`;
    });
  }, [selectedAgent, companyId, runAction]);

  const handleLoginWithClaude = useCallback(() => {
    if (!selectedAgent || !companyId) return;
    runAction("Login with Claude", async () => {
      const result = await agentsApi.loginWithClaude(selectedAgent, companyId);
      if (result.loginUrl) {
        return `Login URL generated: ${result.loginUrl}`;
      }
      if (result.exitCode === 0) {
        return "Claude login completed successfully";
      }
      return `Login process finished (exit code: ${result.exitCode})${result.stderr ? `\n${result.stderr}` : ""}`;
    });
  }, [selectedAgent, companyId, runAction]);

  // ------- Contextual suggestions -------

  const suggestions = useMemo(() => {
    if (!selectedAgent) return [];

    const items: { label: string; action: () => void; icon: typeof Activity }[] = [];

    items.push({ label: "Invoke Heartbeat", action: handleInvokeHeartbeat, icon: Activity });

    // If heartbeat stale
    if (isHeartbeatStale(runtimeData?.lastHeartbeatAt)) {
      items.push({ label: "Wake Agent", action: handleWakeup, icon: Play });
    }

    // If session exists
    if (runtimeData?.sessionState && runtimeData.sessionState.status !== "idle") {
      items.push({ label: "Reset Session", action: handleResetSession, icon: RotateCcw });
    }

    // If validation has errors
    if (validationData && validationData.some((v) => v.severity === "error")) {
      items.push({
        label: "View Validation Issues",
        action: () => {
          const errorSummary = validationData
            .filter((v) => v.severity === "error")
            .map((v) => `  [${v.rule}] ${v.message}`)
            .join("\n");
          appendResult(`Validation errors:\n${errorSummary}`, "error");
        },
        icon: AlertTriangle,
      });
    }

    return items;
  }, [
    selectedAgent,
    runtimeData,
    validationData,
    handleInvokeHeartbeat,
    handleWakeup,
    handleResetSession,
    appendResult,
  ]);

  // ------- Input handler -------

  const handleSendInput = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed) return;
    setInput("");

    // Attempt to match input to known commands
    const lower = trimmed.toLowerCase();
    if (lower.includes("heartbeat") || lower.includes("invoke")) {
      handleInvokeHeartbeat();
    } else if (lower.includes("reset") && lower.includes("session")) {
      handleResetSession();
    } else if (lower.includes("wake")) {
      handleWakeup();
    } else if (lower.includes("login") || lower.includes("claude")) {
      handleLoginWithClaude();
    } else {
      appendResult(
        `Unknown command. Available: invoke heartbeat, reset session, wake agent, login with claude`,
        "info",
      );
    }
  }, [input, handleInvokeHeartbeat, handleResetSession, handleWakeup, handleLoginWithClaude, appendResult]);

  // ------- Resize -------

  const handleResizeStart = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      event.preventDefault();
      const startY = event.clientY;
      const startHeight = claudeDockHeight;

      const handlePointerMove = (moveEvent: MouseEvent) => {
        const delta = startY - moveEvent.clientY;
        const nextHeight = Math.min(MAX_DOCK_HEIGHT, Math.max(MIN_DOCK_HEIGHT, startHeight + delta));
        setClaudeDockHeight(nextHeight);
      };

      const handlePointerUp = () => {
        window.removeEventListener("mousemove", handlePointerMove);
        window.removeEventListener("mouseup", handlePointerUp);
      };

      window.addEventListener("mousemove", handlePointerMove);
      window.addEventListener("mouseup", handlePointerUp);
    },
    [claudeDockHeight, setClaudeDockHeight],
  );

  // ------- Context bar info -------

  const fileName = activeFile?.split("/").pop() ?? null;

  // ------- Render -------

  return (
    <div
      className={cn(
        "flex flex-col border-t border-[hsl(220,13%,20%)] bg-[hsl(220,13%,11%)] transition-[height] duration-200 shrink-0 min-h-0",
      )}
      style={{ height: claudeDockOpen ? `${claudeDockHeight}px` : `${CLOSED_DOCK_HEIGHT}px` }}
    >
      {claudeDockOpen && (
        <div
          onMouseDown={handleResizeStart}
          className="h-1.5 cursor-row-resize bg-[hsl(220,13%,13%)] hover:bg-[hsl(210,70%,40%)] transition-colors flex items-center justify-center"
        >
          <div className="h-[2px] w-10 rounded-full bg-[hsl(220,13%,35%)]" />
        </div>
      )}

      {/* Header with status */}
      <button
        onClick={toggleClaudeDock}
        className="flex items-center gap-2 px-3 h-9 shrink-0 hover:bg-[hsl(220,13%,14%)] transition-colors"
      >
        {status === "action_in_progress" ? (
          <Loader2 className="h-4 w-4 text-blue-400 animate-spin" />
        ) : (
          <Bot className="h-4 w-4 text-[hsl(210,70%,55%)]" />
        )}
        <span className="text-[12px] font-medium text-[hsl(220,13%,70%)]">Claude Agent SDK</span>

        {/* Status dot + label */}
        <span className="flex items-center gap-1.5 ml-2">
          <span className={cn("h-2 w-2 rounded-full shrink-0", statusCfg.dotClass)} />
          <span className={cn("text-[11px]", statusCfg.color)}>{statusCfg.label}</span>
        </span>

        {/* File context */}
        {fileName && (
          <span className="text-[11px] text-[hsl(220,13%,40%)] ml-2 truncate max-w-[200px]">
            {fileName}
          </span>
        )}

        <span className="ml-auto">
          {claudeDockOpen ? (
            <ChevronDown className="h-3.5 w-3.5 text-[hsl(220,13%,45%)]" />
          ) : (
            <ChevronUp className="h-3.5 w-3.5 text-[hsl(220,13%,45%)]" />
          )}
        </span>
      </button>

      {claudeDockOpen && (
        <>
          {/* Context bar */}
          {selectedAgent && (
            <div className="flex items-center gap-3 px-3 py-1.5 border-b border-[hsl(220,13%,18%)] text-[11px] text-[hsl(220,13%,50%)] overflow-x-auto scrollbar-auto-hide">
              {runtimeData && (
                <>
                  <span className="shrink-0">
                    <span className="text-[hsl(220,13%,35%)]">Adapter:</span>{" "}
                    <span className="text-[hsl(220,13%,65%)] font-mono">{runtimeData.adapter}</span>
                  </span>
                  {runtimeData.model && (
                    <span className="shrink-0">
                      <span className="text-[hsl(220,13%,35%)]">Model:</span>{" "}
                      <span className="text-[hsl(220,13%,65%)] font-mono">{runtimeData.model}</span>
                    </span>
                  )}
                  {runtimeData.lastHeartbeatAt && (
                    <span className="shrink-0">
                      <span className="text-[hsl(220,13%,35%)]">Heartbeat:</span>{" "}
                      <span className={cn(
                        "font-mono",
                        isHeartbeatStale(runtimeData.lastHeartbeatAt)
                          ? "text-amber-400"
                          : "text-[hsl(220,13%,65%)]",
                      )}>
                        {timeAgo(runtimeData.lastHeartbeatAt)}
                      </span>
                    </span>
                  )}
                </>
              )}
              {activeFile && (
                <span className="shrink-0 truncate max-w-[200px]">
                  <span className="text-[hsl(220,13%,35%)]">File:</span>{" "}
                  <span className="text-[hsl(220,13%,65%)] font-mono">{activeFile}</span>
                </span>
              )}
              {workspaceRoot && (
                <span className="shrink-0 truncate max-w-[200px]">
                  <span className="text-[hsl(220,13%,35%)]">Root:</span>{" "}
                  <span className="text-[hsl(220,13%,65%)] font-mono">{workspaceRoot}</span>
                </span>
              )}
            </div>
          )}

          {/* Messages area */}
          <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2 scrollbar-auto-hide">
            {messages.map((msg) => (
              <div key={msg.id} className="flex gap-2 text-[12px]">
                {msg.role === "system" ? (
                  <Bot className="h-3.5 w-3.5 shrink-0 mt-0.5 text-[hsl(210,70%,55%)]" />
                ) : msg.variant === "success" ? (
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5 text-green-400" />
                ) : msg.variant === "error" ? (
                  <XCircle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-red-400" />
                ) : (
                  <Circle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-[hsl(210,70%,55%)]" />
                )}
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] text-[hsl(220,13%,35%)] mr-2">
                    [{formatTime(msg.timestamp)}]
                  </span>
                  <span
                    className={cn(
                      "whitespace-pre-wrap",
                      msg.variant === "success"
                        ? "text-green-300"
                        : msg.variant === "error"
                          ? "text-red-300"
                          : "text-[hsl(220,13%,70%)]",
                    )}
                  >
                    {msg.content}
                  </span>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Action suggestions */}
          {suggestions.length > 0 && (
            <div className="flex gap-1.5 px-3 py-1.5 overflow-x-auto scrollbar-auto-hide border-t border-[hsl(220,13%,18%)]">
              {suggestions.map((s) => {
                const Icon = s.icon;
                return (
                  <button
                    key={s.label}
                    disabled={actionInProgress}
                    className={cn(
                      "shrink-0 rounded-full border border-[hsl(220,13%,25%)] px-2.5 py-1 text-[11px] text-[hsl(220,13%,55%)] hover:text-white hover:border-[hsl(210,70%,40%)] transition-colors flex items-center gap-1.5",
                      actionInProgress && "opacity-50 cursor-not-allowed",
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      s.action();
                    }}
                  >
                    {actionInProgress ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Icon className="h-3 w-3" />
                    )}
                    {s.label}
                  </button>
                );
              })}
            </div>
          )}

          {/* Input */}
          <div className="flex items-center gap-2 px-3 py-2 border-t border-[hsl(220,13%,20%)]">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                selectedAgent
                  ? "Type a command: invoke heartbeat, reset session, wake agent..."
                  : "Select an agent to get started..."
              }
              disabled={!selectedAgent || actionInProgress}
              className="flex-1 bg-[hsl(220,13%,16%)] border border-[hsl(220,13%,25%)] rounded px-3 py-1.5 text-[12px] text-white placeholder:text-[hsl(220,13%,35%)] outline-none focus:border-[hsl(210,70%,45%)] disabled:opacity-50"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSendInput();
              }}
            />
            <Button
              variant="ghost"
              size="icon-xs"
              className="text-[hsl(210,70%,55%)] hover:text-white hover:bg-[hsl(220,13%,20%)]"
              disabled={!selectedAgent || actionInProgress || !input.trim()}
              onClick={handleSendInput}
            >
              {actionInProgress ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
