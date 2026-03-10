import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@/lib/router";
import { Button } from "@/components/ui/button";
import { attachApi } from "../api/attach";
import type { DiscoveryResult, DiscoveredAgent } from "@paperclipai/shared";
import {
  Plug,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { cn } from "../lib/utils";

// --- Step indicator ---

function StepIndicator({ currentStep }: { currentStep: number }) {
  const steps = ["Connection Details", "Discovery Results", "Company Details", "Success"];

  return (
    <div className="flex items-center justify-center gap-2">
      {steps.map((label, i) => {
        const isCompleted = i < currentStep;
        const isActive = i === currentStep;

        return (
          <div key={label} className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <div
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium",
                  isCompleted
                    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                    : isActive
                      ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                      : "bg-muted text-muted-foreground",
                )}
              >
                {isCompleted ? <CheckCircle2 className="h-3.5 w-3.5" /> : i + 1}
              </div>
              <span
                className={cn(
                  "text-xs font-medium",
                  isActive ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={cn(
                  "h-px w-8",
                  isCompleted ? "bg-green-300 dark:bg-green-700" : "bg-border",
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// --- Step 1: Connection Details ---

function ConnectionStep({
  gatewayUrl,
  workspacePath,
  onGatewayUrlChange,
  onWorkspacePathChange,
  onDiscover,
  onBackToOptions,
  isPending,
  error,
}: {
  gatewayUrl: string;
  workspacePath: string;
  onGatewayUrlChange: (v: string) => void;
  onWorkspacePathChange: (v: string) => void;
  onDiscover: () => void;
  onBackToOptions: () => void;
  isPending: boolean;
  error: Error | null;
}) {
  const [touched, setTouched] = useState({ gateway: false, workspace: false });

  const gatewayEmpty = touched.gateway && gatewayUrl.trim().length === 0;
  const workspaceEmpty = touched.workspace && workspacePath.trim().length === 0;
  const canDiscover = gatewayUrl.trim().length > 0 && workspacePath.trim().length > 0;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Connection Details</h2>
        <p className="text-sm text-muted-foreground">
          Provide the gateway URL and workspace path for your existing OpenClaw environment.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label htmlFor="gateway-url" className="block text-sm font-medium mb-1.5">
            Gateway URL
          </label>
          <input
            id="gateway-url"
            type="text"
            value={gatewayUrl}
            onChange={(e) => onGatewayUrlChange(e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, gateway: true }))}
            placeholder="http://localhost:18789/v1/responses"
            className={cn(
              "w-full rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
              gatewayEmpty ? "border-destructive" : "border-border",
            )}
            autoFocus
          />
          {gatewayEmpty && (
            <p className="mt-1 text-xs text-destructive">Gateway URL is required.</p>
          )}
        </div>

        <div>
          <label htmlFor="workspace-path" className="block text-sm font-medium mb-1.5">
            Workspace Path
          </label>
          <input
            id="workspace-path"
            type="text"
            value={workspacePath}
            onChange={(e) => onWorkspacePathChange(e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, workspace: true }))}
            placeholder="/path/to/your/openclaw/workspace"
            className={cn(
              "w-full rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
              workspaceEmpty ? "border-destructive" : "border-border",
            )}
          />
          {workspaceEmpty && (
            <p className="mt-1 text-xs text-destructive">Workspace path is required.</p>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {error.message}
        </div>
      )}

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBackToOptions}
          className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          <ArrowLeft className="mr-1 h-3 w-3 inline" />
          Back to options
        </button>
        <Button onClick={onDiscover} disabled={!canDiscover || isPending}>
          {isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Discovering...
            </>
          ) : (
            <>
              <Plug className="mr-2 h-4 w-4" />
              Discover
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

// --- Agent status badge ---

function AgentStatusBadge({ status }: { status: DiscoveredAgent["status"] }) {
  if (status === "complete") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
        <CheckCircle2 className="h-3 w-3" />
        Complete
      </span>
    );
  }
  if (status === "partial") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
        <AlertTriangle className="h-3 w-3" />
        Partial
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400">
      <XCircle className="h-3 w-3" />
      Missing
    </span>
  );
}

// --- Step 2: Discovery Results ---

function DiscoveryStep({
  discovery,
  selectedFolders,
  onToggleFolder,
  onBack,
  onContinue,
}: {
  discovery: DiscoveryResult;
  selectedFolders: Set<string>;
  onToggleFolder: (folder: string) => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  const canContinue = discovery.overallStatus !== "invalid" && selectedFolders.size > 0;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Discovery Results</h2>
        <p className="text-sm text-muted-foreground">
          Review the discovered agents and select which ones to import.
        </p>
      </div>

      {/* Gateway health */}
      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className="mt-0.5">
            {discovery.gatewayHealthy ? (
              <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
            ) : (
              <XCircle className="h-4 w-4 text-red-500 dark:text-red-400" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Gateway Health</p>
            <p className="text-xs text-muted-foreground">
              {discovery.gatewayHealthy
                ? `Connected to ${discovery.gatewayUrl}`
                : discovery.gatewayError ?? "Gateway is unreachable"}
            </p>
          </div>
        </div>

        {/* Config */}
        <div className="flex items-start gap-3">
          <div className="mt-0.5">
            {discovery.configFound ? (
              <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
            ) : (
              <XCircle className="h-4 w-4 text-red-500 dark:text-red-400" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Workspace Config</p>
            <p className="text-xs text-muted-foreground">
              {discovery.configFound
                ? `Found at ${discovery.configPath ?? discovery.workspacePath}`
                : "No configuration file found in workspace"}
            </p>
          </div>
        </div>

        {/* Workspace info */}
        {(discovery.workspaceName || discovery.workspaceVersion) && (
          <div className="flex items-start gap-3">
            <div className="mt-0.5">
              <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">Workspace Info</p>
              <p className="text-xs text-muted-foreground">
                {[discovery.workspaceName, discovery.workspaceVersion && `v${discovery.workspaceVersion}`]
                  .filter(Boolean)
                  .join(" - ")}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Agents list */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium">
          Discovered Agents ({discovery.agents.length})
        </h3>
        {discovery.agents.length === 0 ? (
          <p className="text-sm text-muted-foreground">No agents found in workspace.</p>
        ) : (
          <div className="rounded-lg border border-border divide-y divide-border">
            {discovery.agents.map((agent) => {
              const isMissing = agent.status === "missing";
              const isChecked = selectedFolders.has(agent.folder);
              const missingFiles = agent.files.filter((f) => !f.exists);

              return (
                <label
                  key={agent.folder}
                  className={cn(
                    "flex items-start gap-3 p-3 cursor-pointer transition-colors",
                    isMissing
                      ? "opacity-50 cursor-not-allowed"
                      : "hover:bg-muted/50",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    disabled={isMissing}
                    onChange={() => onToggleFolder(agent.folder)}
                    className="mt-1 h-4 w-4 rounded border-border"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{agent.name}</span>
                      <AgentStatusBadge status={agent.status} />
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {agent.role} &mdash; {agent.folder}
                    </p>
                    {missingFiles.length > 0 && (
                      <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-0.5">
                        Missing: {missingFiles.map((f) => f.name).join(", ")}
                      </p>
                    )}
                  </div>
                </label>
              );
            })}
          </div>
        )}
      </div>

      {/* Issues */}
      {discovery.issues.length > 0 && (
        <div className="rounded-lg border border-yellow-300 dark:border-yellow-700 bg-yellow-50 dark:bg-yellow-900/20 p-3 space-y-1">
          <p className="text-sm font-medium text-yellow-800 dark:text-yellow-300">Issues</p>
          <ul className="list-disc list-inside space-y-0.5">
            {discovery.issues.map((issue, i) => (
              <li key={i} className="text-xs text-yellow-700 dark:text-yellow-400">
                {issue}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Overall status error */}
      {discovery.overallStatus === "invalid" && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          The workspace is invalid and cannot be attached. Please fix the issues above and try again.
        </div>
      )}

      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="mr-1 h-3 w-3" />
          Back
        </Button>
        <Button onClick={onContinue} disabled={!canContinue}>
          Continue
          <ArrowRight className="ml-1 h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

// --- Step 3: Company Details ---

function CompanyDetailsStep({
  companyName,
  companyDescription,
  agentCount,
  workspacePath,
  onCompanyNameChange,
  onCompanyDescriptionChange,
  onBack,
  onAttach,
  isPending,
  error,
}: {
  companyName: string;
  companyDescription: string;
  agentCount: number;
  workspacePath: string;
  onCompanyNameChange: (v: string) => void;
  onCompanyDescriptionChange: (v: string) => void;
  onBack: () => void;
  onAttach: () => void;
  isPending: boolean;
  error: Error | null;
}) {
  const canAttach = companyName.trim().length > 0 && companyName.trim().length <= 200;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Company Details</h2>
        <p className="text-sm text-muted-foreground">
          Give your company a name and finalize the attachment.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label htmlFor="attach-company-name" className="block text-sm font-medium mb-1.5">
            Company Name
          </label>
          <input
            id="attach-company-name"
            type="text"
            value={companyName}
            onChange={(e) => onCompanyNameChange(e.target.value)}
            placeholder="e.g. Acme Corp"
            maxLength={200}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            autoFocus
          />
          {companyName.length > 200 && (
            <p className="mt-1 text-xs text-destructive">Company name must be 200 characters or fewer.</p>
          )}
        </div>

        <div>
          <label htmlFor="attach-company-description" className="block text-sm font-medium mb-1.5">
            Description
            <span className="ml-1 text-xs text-muted-foreground font-normal">(optional)</span>
          </label>
          <textarea
            id="attach-company-description"
            value={companyDescription}
            onChange={(e) => onCompanyDescriptionChange(e.target.value)}
            placeholder="Briefly describe what this company does"
            rows={3}
            maxLength={2000}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 resize-none"
          />
        </div>
      </div>

      <div className="rounded-lg border border-l-4 border-l-blue-500 bg-muted/30 px-4 py-3">
        <p className="text-sm text-muted-foreground">
          {agentCount} agent{agentCount !== 1 ? "s" : ""} will be attached from{" "}
          <span className="font-mono text-xs">{workspacePath}</span>
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {error.message}
        </div>
      )}

      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onBack} disabled={isPending}>
          <ArrowLeft className="mr-1 h-3 w-3" />
          Back
        </Button>
        <Button onClick={onAttach} disabled={!canAttach || isPending}>
          {isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Attaching...
            </>
          ) : (
            <>
              <Plug className="mr-2 h-4 w-4" />
              Attach
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

// --- Step 4: Success ---

function SuccessStep({
  companyName,
  agentCount,
  gatewayUrl,
  issuePrefix,
}: {
  companyName: string;
  agentCount: number;
  gatewayUrl: string;
  issuePrefix: string;
}) {
  const navigate = useNavigate();

  return (
    <div className="space-y-6 text-center">
      <div className="flex justify-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
          <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
        </div>
      </div>

      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Successfully attached!</h2>
        <p className="text-sm text-muted-foreground">
          Your OpenClaw workspace has been connected to Paperclip.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-card p-4 space-y-3 text-left">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Company
          </p>
          <p className="mt-0.5 text-sm font-medium">{companyName}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Agents Imported
          </p>
          <p className="mt-0.5 text-sm font-medium">{agentCount}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Gateway URL
          </p>
          <p className="mt-0.5 text-sm font-mono text-xs">{gatewayUrl}</p>
        </div>
      </div>

      <div className="flex justify-center">
        <Button onClick={() => navigate(`/${issuePrefix}/dashboard`)}>
          Go to Dashboard
          <ArrowRight className="ml-1 h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

// --- Session storage persistence ---

const STORAGE_KEY = "paperclip.attachWizard";

function loadWizardState() {
  try {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch { return null; }
}

function clearWizardState() {
  sessionStorage.removeItem(STORAGE_KEY);
}

// --- Main page ---

export default function AttachWizard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const saved = loadWizardState();
  const [step, setStep] = useState(saved?.step ?? 0);
  const [gatewayUrl, setGatewayUrl] = useState(saved?.gatewayUrl ?? "");
  const [workspacePath, setWorkspacePath] = useState(saved?.workspacePath ?? "");
  const [companyName, setCompanyName] = useState(saved?.companyName ?? "");
  const [companyDescription, setCompanyDescription] = useState(saved?.companyDescription ?? "");

  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
      step,
      gatewayUrl,
      workspacePath,
      companyName,
      companyDescription,
    }));
  }, [step, gatewayUrl, workspacePath, companyName, companyDescription]);

  const [discovery, setDiscovery] = useState<DiscoveryResult | null>(null);
  const [selectedFolders, setSelectedFolders] = useState<Set<string>>(new Set());
  const [attachResult, setAttachResult] = useState<{
    companyName: string;
    agentCount: number;
    gatewayUrl: string;
    issuePrefix: string;
  } | null>(null);

  const discoverMutation = useMutation({
    mutationFn: () => attachApi.discover(gatewayUrl.trim(), workspacePath.trim()),
    onSuccess: (result) => {
      setDiscovery(result);
      // Pre-select all non-missing agents
      const selectable = result.agents
        .filter((a) => a.status !== "missing")
        .map((a) => a.folder);
      setSelectedFolders(new Set(selectable));
      setStep(1);
    },
  });

  const confirmMutation = useMutation({
    mutationFn: () =>
      attachApi.confirm({
        gatewayUrl: gatewayUrl.trim(),
        workspacePath: workspacePath.trim(),
        companyName: companyName.trim(),
        companyDescription: companyDescription.trim() || undefined,
        selectedAgentFolders: Array.from(selectedFolders),
      }),
    onSuccess: (result) => {
      // Invalidate company list so sidebar updates immediately
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      clearWizardState();
      setAttachResult({
        companyName: result.companyName,
        agentCount: result.agentsCreated,
        gatewayUrl: result.gatewayUrl,
        issuePrefix: result.issuePrefix,
      });
      setStep(3);
    },
  });

  const handleToggleFolder = (folder: string) => {
    setSelectedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folder)) {
        next.delete(folder);
      } else {
        next.add(folder);
      }
      return next;
    });
  };

  return (
    <div className="mx-auto max-w-2xl p-6 space-y-8">
      {/* Header */}
      <div className="space-y-1 text-center">
        <h1 className="text-xl font-semibold">Attach Existing OpenClaw</h1>
        <p className="text-sm text-muted-foreground">
          Connect Paperclip to an existing OpenClaw workspace
        </p>
      </div>

      {/* Step indicator */}
      <StepIndicator currentStep={step} />

      {/* Step content */}
      <div className="rounded-lg border border-border bg-card p-6">
        {step === 0 && (
          <ConnectionStep
            gatewayUrl={gatewayUrl}
            workspacePath={workspacePath}
            onGatewayUrlChange={setGatewayUrl}
            onWorkspacePathChange={setWorkspacePath}
            onDiscover={() => discoverMutation.mutate()}
            onBackToOptions={() => navigate("/get-started")}
            isPending={discoverMutation.isPending}
            error={discoverMutation.error instanceof Error ? discoverMutation.error : null}
          />
        )}

        {step === 1 && discovery && (
          <DiscoveryStep
            discovery={discovery}
            selectedFolders={selectedFolders}
            onToggleFolder={handleToggleFolder}
            onBack={() => setStep(0)}
            onContinue={() => setStep(2)}
          />
        )}

        {step === 2 && (
          <CompanyDetailsStep
            companyName={companyName}
            companyDescription={companyDescription}
            agentCount={selectedFolders.size}
            workspacePath={workspacePath}
            onCompanyNameChange={setCompanyName}
            onCompanyDescriptionChange={setCompanyDescription}
            onBack={() => setStep(1)}
            onAttach={() => confirmMutation.mutate()}
            isPending={confirmMutation.isPending}
            error={confirmMutation.error instanceof Error ? confirmMutation.error : null}
          />
        )}

        {step === 3 && attachResult && (
          <SuccessStep
            companyName={attachResult.companyName}
            agentCount={attachResult.agentCount}
            gatewayUrl={attachResult.gatewayUrl}
            issuePrefix={attachResult.issuePrefix}
          />
        )}
      </div>
    </div>
  );
}
