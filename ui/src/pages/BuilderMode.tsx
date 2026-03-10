import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "@/lib/router";
import {
  ChevronRight,
  ChevronDown,
  File,
  Folder,
  FolderOpen,
  Loader2,
  Play,
  RefreshCw,
  ArrowLeft,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { experienceApi } from "../api/experience";
import { onboardingApi } from "../api/onboarding";
import { ApiError } from "../api/client";
import { cn } from "../lib/utils";
import type { BuildStatus, BuildLogEntry, BuildRun, GeneratedFileNode } from "@paperclipai/shared";

// --- Stage descriptions for the product status panel ---

const STAGE_DESCRIPTIONS: Record<string, string> = {
  queued: "Preparing to build your hybrid team...",
  compiling: "Compiling your organization design into agent specifications. This translates your approved org design into concrete agent roles and configurations.",
  generating_workspaces: "Creating workspace files and configurations for each agent. Each agent gets its own directory with instructions, tools, and permissions.",
  validating: "Running validation checks to ensure all configurations are correct and complete before provisioning.",
  provisioning: "Registering your agents and finalizing configurations. Almost there.",
  completed: "Your hybrid team configuration is complete and ready for use.",
  failed: "The build process encountered an error. Review the details below and retry.",
};

// --- Status badge ---

const STATUS_COLORS: Record<BuildStatus, string> = {
  queued: "bg-muted text-muted-foreground",
  compiling: "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300",
  generating_workspaces: "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300",
  validating: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300",
  provisioning: "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300",
  completed: "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300",
  failed: "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300",
};

const STATUS_LABELS: Record<BuildStatus, string> = {
  queued: "Queued",
  compiling: "Compiling",
  generating_workspaces: "Generating Workspaces",
  validating: "Validating",
  provisioning: "Provisioning",
  completed: "Completed",
  failed: "Failed",
};

const STAGE_LABELS: Record<string, string> = {
  initializing: "Initializing",
  queued: "Queued",
  compiling: "Compiling Org Design",
  generating_workspaces: "Generating Agent Workspaces",
  validating: "Validating Configuration",
  provisioning: "Provisioning Team",
  completed: "Complete",
  failed: "Failed",
};

function BuildStatusBadge({ status }: { status: BuildStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        STATUS_COLORS[status],
      )}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

// --- File tree ---

function FileTreeNode({ node, depth = 0 }: { node: GeneratedFileNode; depth?: number }) {
  const [expanded, setExpanded] = useState(depth < 2);
  const isDir = node.type === "directory";

  return (
    <div>
      <button
        onClick={() => isDir && setExpanded(!expanded)}
        className={cn(
          "flex w-full items-center gap-1.5 rounded px-2 py-1 text-xs hover:bg-muted/50",
          !isDir && "cursor-default",
        )}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        {isDir ? (
          <>
            {expanded ? (
              <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
            )}
            {expanded ? (
              <FolderOpen className="h-3.5 w-3.5 shrink-0 text-blue-500" />
            ) : (
              <Folder className="h-3.5 w-3.5 shrink-0 text-blue-500" />
            )}
          </>
        ) : (
          <>
            <span className="w-3 shrink-0" />
            <File className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          </>
        )}
        <span className="truncate">{node.name}</span>
      </button>
      {isDir && expanded && node.children?.map((child) => (
        <FileTreeNode key={child.path} node={child} depth={depth + 1} />
      ))}
    </div>
  );
}

function FileTreePanel({ programId }: { programId: string }) {
  const { data: tree, isLoading } = useQuery({
    queryKey: ["build-files", programId],
    queryFn: () => experienceApi.getGeneratedFiles(programId),
  });

  return (
    <div className="rounded-lg border border-border p-3">
      <h2 className="text-xs font-medium uppercase text-muted-foreground mb-2">
        Generated Files
      </h2>
      {isLoading ? (
        <p className="text-xs text-muted-foreground">Loading...</p>
      ) : !tree || (tree.type === "directory" && (!tree.children || tree.children.length === 0)) ? (
        <p className="text-xs text-muted-foreground">No files generated yet</p>
      ) : (
        <FileTreeNode node={tree} />
      )}
    </div>
  );
}

// --- Build log ---

function levelColor(level: BuildLogEntry["level"]): string {
  switch (level) {
    case "warn":
      return "text-yellow-400";
    case "error":
      return "text-red-400";
    default:
      return "text-gray-300";
  }
}

function formatTime(timestamp: string): string {
  try {
    const d = new Date(timestamp);
    return d.toLocaleTimeString("en-US", { hour12: false });
  } catch {
    return timestamp;
  }
}

function BuildLogView({ log }: { log: BuildLogEntry[] }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.scrollTo(0, ref.current.scrollHeight);
  }, [log]);

  return (
    <div
      ref={ref}
      className="bg-gray-950 rounded-lg p-4 font-mono text-sm h-96 overflow-y-auto"
    >
      {log.length === 0 ? (
        <p className="text-gray-500">Waiting for build output...</p>
      ) : (
        log.map((entry, i) => (
          <div key={i} className={cn("py-0.5", levelColor(entry.level))}>
            <span className="text-gray-600">[{formatTime(entry.timestamp)}]</span>{" "}
            <span className="text-gray-400">[{entry.stage}]</span>{" "}
            {entry.message}
          </div>
        ))
      )}
    </div>
  );
}

// --- Product Status Panel (primary layer) ---

function ProductStatusPanel({
  buildRun,
  onRetry,
  retrying,
}: {
  buildRun: BuildRun;
  onRetry: () => void;
  retrying: boolean;
}) {
  const progressPct = Math.round(buildRun.stageProgress * 100);
  const stageLabel = STAGE_LABELS[buildRun.currentStage] ?? buildRun.currentStage.replace(/_/g, " ");
  const stageDescription = STAGE_DESCRIPTIONS[buildRun.status] ?? STAGE_DESCRIPTIONS[buildRun.currentStage] ?? "";

  const isRunning = !["completed", "failed"].includes(buildRun.status);
  const isFailed = buildRun.status === "failed";
  const isCompleted = buildRun.status === "completed";

  return (
    <div className="rounded-lg border border-border bg-card p-6 space-y-5">
      {/* Stage indicator */}
      <div className="flex items-start gap-3">
        <div className="mt-0.5">
          {isCompleted ? (
            <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
          ) : isFailed ? (
            <AlertCircle className="h-6 w-6 text-red-500 dark:text-red-400" />
          ) : (
            <Loader2 className="h-6 w-6 animate-spin text-blue-500 dark:text-blue-400" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold">{stageLabel}</h2>
            <BuildStatusBadge status={buildRun.status} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
            {stageDescription}
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-medium text-muted-foreground">{stageLabel}</span>
          <span className="text-xs font-medium text-muted-foreground">{progressPct}%</span>
        </div>
        <div className="h-2 w-full rounded-full bg-muted">
          <div
            className={cn(
              "h-2 rounded-full transition-all duration-500",
              isFailed
                ? "bg-red-500 dark:bg-red-400"
                : isCompleted
                  ? "bg-green-500 dark:bg-green-400"
                  : "bg-blue-500 dark:bg-blue-400",
            )}
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-6 pt-1">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Agents</span>
          <span className="text-sm font-semibold">{buildRun.agentCount}</span>
        </div>
        <div className="h-4 w-px bg-border" />
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Files</span>
          <span className="text-sm font-semibold">{buildRun.fileCount}</span>
        </div>
        <div className="h-4 w-px bg-border" />
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Validation</span>
          {buildRun.validationPassed === null ? (
            <span className="text-xs text-muted-foreground">Pending</span>
          ) : buildRun.validationPassed ? (
            <span className={cn(
              "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
              "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300",
            )}>
              Passed
            </span>
          ) : (
            <span className={cn(
              "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
              "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300",
            )}>
              Failed
            </span>
          )}
        </div>
        {isRunning && (
          <>
            <div className="h-4 w-px bg-border" />
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              In progress
            </div>
          </>
        )}
      </div>

      {/* Error display */}
      {isFailed && buildRun.errorMessage && (
        <div className="rounded-md border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-4 w-4 text-red-500 dark:text-red-400 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-red-700 dark:text-red-400">Build Error</p>
              <p className="mt-1 text-sm text-red-700 dark:text-red-400">{buildRun.errorMessage}</p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={onRetry}
              disabled={retrying}
              className="shrink-0"
            >
              {retrying ? (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              ) : (
                <RefreshCw className="mr-1 h-3 w-3" />
              )}
              Retry
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Technical Details Disclosure ---

function TechnicalDetailsDisclosure({
  programId,
  buildRun,
  defaultOpen,
}: {
  programId: string;
  buildRun: BuildRun;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-lg border border-border">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        {open ? (
          <ChevronDown className="h-4 w-4 shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0" />
        )}
        {open ? "Hide Technical Details" : "Show Technical Details"}
      </button>
      {open && (
        <div className="border-t border-border px-4 pb-4 pt-3">
          <div className="grid gap-4 lg:grid-cols-3">
            {/* Build log */}
            <div className="lg:col-span-2">
              <div className="rounded-lg border border-border p-3">
                <h2 className="text-xs font-medium uppercase text-muted-foreground mb-2">
                  Build Log
                </h2>
                <BuildLogView log={buildRun.log ?? []} />
              </div>
            </div>
            {/* File tree */}
            <div className="lg:col-span-1">
              <FileTreePanel programId={programId} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Main page ---

export default function BuilderMode() {
  const { programId } = useParams<{ programId: string }>();
  const queryClient = useQueryClient();

  const { data: program } = useQuery({
    queryKey: ["onboarding-program", programId],
    queryFn: () => onboardingApi.getProgram(programId!),
    enabled: !!programId,
  });

  const { data: buildRun, isLoading, error } = useQuery({
    queryKey: ["build-run", programId],
    queryFn: async () => {
      try {
        return await experienceApi.getBuildRun(programId!);
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) {
          return null;
        }
        throw err;
      }
    },
    enabled: !!programId,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data?.status && !["completed", "failed"].includes(data.status)) {
        return 3000;
      }
      return false;
    },
  });

  const startMutation = useMutation({
    mutationFn: (force?: boolean) =>
      experienceApi.startBuild(programId!, force),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["build-run", programId] });
      queryClient.invalidateQueries({ queryKey: ["build-files", programId] });
    },
  });

  if (!programId) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        No program specified.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading build status...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-sm text-destructive">
        {error instanceof Error ? error.message : "Failed to load build status"}
      </div>
    );
  }

  const hasBuild = !!buildRun;
  const isActive =
    hasBuild && !["completed", "failed"].includes(buildRun.status);

  // Technical details default open when actively building or failed
  const technicalDetailsDefaultOpen = hasBuild && (isActive || buildRun.status === "failed");

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link to="/onboarding/start">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold">Build & Deploy</h1>
              {hasBuild && <BuildStatusBadge status={buildRun.status} />}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {program?.title || "Onboarding Program"} — Compiling your hybrid team
            </p>
          </div>
        </div>
        <div />
      </div>

      {startMutation.isError && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {startMutation.error instanceof Error
            ? startMutation.error.message
            : "Failed to start build"}
        </div>
      )}

      {hasBuild && buildRun.status === "completed" && (
        <div className="rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-green-800 dark:text-green-300">Your Hybrid Team is Ready</h2>
              <p className="mt-1 text-sm text-green-700 dark:text-green-400">
                Successfully configured {buildRun.agentCount} agent{buildRun.agentCount === 1 ? "" : "s"} with {buildRun.fileCount} configuration files.
                {buildRun.validationPassed ? " All validation checks passed." : ""}
              </p>
              <p className="mt-2 text-sm text-green-600 dark:text-green-400">
                Your agent configurations are complete. Head to the dashboard to manage your team.
              </p>
            </div>
            <Link to="/dashboard">
              <Button size="sm">
                Go to Dashboard
                <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            </Link>
          </div>
        </div>
      )}

      {!hasBuild ? (
        <div className="rounded-lg border border-border p-8">
          <div className="mx-auto max-w-md text-center">
            <Play className="mx-auto h-10 w-10 text-muted-foreground/30" />
            <h2 className="mt-4 text-sm font-semibold">Ready to Build</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              This will compile your approved org design into agent workspaces,
              generate configuration files, and provision your hybrid team.
            </p>
            <div className="mt-4 flex flex-col items-center gap-2">
              <Button
                onClick={() => startMutation.mutate(undefined)}
                disabled={startMutation.isPending}
              >
                {startMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Play className="mr-2 h-4 w-4" />
                )}
                Start Build
              </Button>
              <p className="text-xs text-muted-foreground">
                Typically completes in under a minute
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Primary Layer: Product Status Panel */}
          <ProductStatusPanel
            buildRun={buildRun}
            onRetry={() => startMutation.mutate(true)}
            retrying={startMutation.isPending}
          />

          {/* Secondary Layer: Technical Details (collapsible) */}
          <TechnicalDetailsDisclosure
            programId={programId}
            buildRun={buildRun}
            defaultOpen={technicalDetailsDefaultOpen}
          />
        </div>
      )}
    </div>
  );
}
