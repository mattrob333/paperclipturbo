import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { AdapterEnvironmentTestResult, CompanySecret } from "@paperclipai/shared";
import { useDialog } from "../context/DialogContext";
import { useCompany } from "../context/CompanyContext";
import { companiesApi } from "../api/companies";
import { goalsApi } from "../api/goals";
import { agentsApi } from "../api/agents";
import { issuesApi } from "../api/issues";
import { secretsApi } from "../api/secrets";
import { queryKeys } from "../lib/queryKeys";
import { Dialog, DialogPortal } from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "../lib/utils";
import { extractModelName, extractProviderIdWithFallback } from "../lib/model-utils";
import { getUIAdapter } from "../adapters";
import { defaultCreateValues } from "./agent-config-defaults";
import {
  DEFAULT_CODEX_LOCAL_BYPASS_APPROVALS_AND_SANDBOX,
  DEFAULT_CODEX_LOCAL_MODEL
} from "@paperclipai/adapter-codex-local";
import { DEFAULT_CURSOR_LOCAL_MODEL } from "@paperclipai/adapter-cursor-local";
import { AsciiArtAnimation } from "./AsciiArtAnimation";
import { ChoosePathButton } from "./PathInstructionsModal";
import { HintIcon } from "./agent-config-primitives";
import { OpenCodeLogoIcon } from "./OpenCodeLogoIcon";
import {
  Building2,
  Bot,
  Code,
  ListTodo,
  Rocket,
  ArrowLeft,
  ArrowRight,
  Terminal,
  Globe,
  Sparkles,
  MousePointer2,
  Check,
  Loader2,
  FolderOpen,
  ChevronDown,
  Key,
  X
} from "lucide-react";

type Step = 1 | 2 | 3 | 4;
type AdapterType =
  | "claude_local"
  | "codex_local"
  | "opencode_local"
  | "cursor"
  | "process"
  | "http"
  | "openclaw";

const DEFAULT_TASK_DESCRIPTION = `Set up the Executive Assistant as the primary point of contact for this workspace.

 This agent should be the front-door operator the human user talks to most often. In solo mode, that means the builder is setting up this assistant for themself. In client or consulting mode, it should represent the primary sponsor or operating lead you want to train on the system first.

 Start by defining the assistant's operating role, responsibilities, and working style inside the OpenClaw workspace. Then prepare the next specialist agents this assistant should coordinate with based on the initial use case.`;

const DEFAULT_PRIMARY_AGENT_NAME = "Executive Assistant";
const DEFAULT_PRIMARY_AGENT_ROLE = "executive_assistant";
const DEFAULT_PRIMARY_TASK_TITLE = "Define the Executive Assistant's operating brief";

const DEFAULT_OPENCLAW_WORKSPACE = "/openclaw-workspace";
const DEFAULT_OPENCLAW_GATEWAY_URL = "http://host.docker.internal:18789/v1/responses";

function normalizeOpenClawGatewayUrl(rawValue: string): string {
  const trimmed = rawValue.trim();
  if (!trimmed) return DEFAULT_OPENCLAW_GATEWAY_URL;
  try {
    const parsed = new URL(trimmed);
    if (!parsed.pathname || parsed.pathname === "/") {
      parsed.pathname = "/v1/responses";
    }
    return parsed.toString();
  } catch {
    return trimmed;
  }
}

export function OnboardingWizard() {
  const { onboardingOpen, onboardingOptions, closeOnboarding } = useDialog();
  const { selectedCompanyId, companies, setSelectedCompanyId } = useCompany();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const initialStep = onboardingOptions.initialStep ?? 1;
  const existingCompanyId = onboardingOptions.companyId;

  const [step, setStep] = useState<Step>(initialStep);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modelOpen, setModelOpen] = useState(false);
  const [modelSearch, setModelSearch] = useState("");

  // Step 1
  const [companyName, setCompanyName] = useState("");
  const [companyGoal, setCompanyGoal] = useState("");

  // Step 2
  const [agentName, setAgentName] = useState(DEFAULT_PRIMARY_AGENT_NAME);
  const [adapterType, setAdapterType] = useState<AdapterType>("openclaw");
  const [cwd, setCwd] = useState("");
  const [model, setModel] = useState("");
  const [command, setCommand] = useState("");
  const [args, setArgs] = useState("");
  const [url, setUrl] = useState("");
  const [adapterEnvResult, setAdapterEnvResult] =
    useState<AdapterEnvironmentTestResult | null>(null);
  const [adapterEnvError, setAdapterEnvError] = useState<string | null>(null);
  const [adapterEnvLoading, setAdapterEnvLoading] = useState(false);
  const [forceUnsetAnthropicApiKey, setForceUnsetAnthropicApiKey] =
    useState(false);
  const [unsetAnthropicLoading, setUnsetAnthropicLoading] = useState(false);

  // Step 2 - Secret reference for API keys
  const [selectedSecretId, setSelectedSecretId] = useState<string | null>(null);
  const [inlineSecretName, setInlineSecretName] = useState("");
  const [inlineSecretValue, setInlineSecretValue] = useState("");
  const [inlineSecretOpen, setInlineSecretOpen] = useState(false);

  // Step 3
  const [taskTitle, setTaskTitle] = useState(DEFAULT_PRIMARY_TASK_TITLE);
  const [taskDescription, setTaskDescription] = useState(
    DEFAULT_TASK_DESCRIPTION
  );

  // Auto-grow textarea for task description
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const autoResizeTextarea = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }, []);

  // Created entity IDs — pre-populate from existing company when skipping step 1
  const [createdCompanyId, setCreatedCompanyId] = useState<string | null>(
    existingCompanyId ?? null
  );
  const [createdCompanyPrefix, setCreatedCompanyPrefix] = useState<
    string | null
  >(null);
  const [createdAgentId, setCreatedAgentId] = useState<string | null>(null);
  const [createdIssueRef, setCreatedIssueRef] = useState<string | null>(null);

  // Sync step and company when onboarding opens with options.
  // Keep this independent from company-list refreshes so Step 1 completion
  // doesn't get reset after creating a company.
  useEffect(() => {
    if (!onboardingOpen) return;
    const cId = onboardingOptions.companyId ?? null;
    setStep(onboardingOptions.initialStep ?? 1);
    setCreatedCompanyId(cId);
    setCreatedCompanyPrefix(null);
  }, [
    onboardingOpen,
    onboardingOptions.companyId,
    onboardingOptions.initialStep
  ]);

  // Backfill issue prefix for an existing company once companies are loaded.
  useEffect(() => {
    if (!onboardingOpen || !createdCompanyId || createdCompanyPrefix) return;
    const company = companies.find((c) => c.id === createdCompanyId);
    if (company) setCreatedCompanyPrefix(company.issuePrefix);
  }, [onboardingOpen, createdCompanyId, createdCompanyPrefix, companies]);

  // Resize textarea when step 3 is shown or description changes
  useEffect(() => {
    if (step === 3) autoResizeTextarea();
  }, [step, taskDescription, autoResizeTextarea]);

  const {
    data: adapterModels,
    error: adapterModelsError,
    isLoading: adapterModelsLoading,
    isFetching: adapterModelsFetching,
  } = useQuery({
    queryKey:
      createdCompanyId
        ? queryKeys.agents.adapterModels(createdCompanyId, adapterType)
        : ["agents", "none", "adapter-models", adapterType],
    queryFn: () => agentsApi.adapterModels(createdCompanyId!, adapterType),
    enabled: Boolean(createdCompanyId) && onboardingOpen && step === 2
  });

  const { data: availableSecrets = [] } = useQuery({
    queryKey: createdCompanyId
      ? queryKeys.secrets.list(createdCompanyId)
      : ["secrets", "none"],
    queryFn: () => secretsApi.list(createdCompanyId!),
    enabled: Boolean(createdCompanyId) && onboardingOpen && step === 2,
  });

  const createSecretMutation = useMutation({
    mutationFn: (data: { name: string; value: string }) => {
      if (!createdCompanyId) throw new Error("Company required");
      return secretsApi.create(createdCompanyId, data);
    },
    onSuccess: (created: CompanySecret) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.secrets.list(createdCompanyId!),
      });
      setSelectedSecretId(created.id);
      setInlineSecretOpen(false);
      setInlineSecretName("");
      setInlineSecretValue("");
    },
  });

  const isLocalAdapter =
    adapterType === "claude_local" || adapterType === "codex_local" || adapterType === "opencode_local" || adapterType === "cursor";
  const effectiveAdapterCommand =
    command.trim() ||
    (adapterType === "codex_local"
      ? "codex"
      : adapterType === "cursor"
        ? "agent"
        : adapterType === "opencode_local"
          ? "opencode"
          : "claude");

  useEffect(() => {
    if (step !== 2) return;
    setAdapterEnvResult(null);
    setAdapterEnvError(null);
  }, [step, adapterType, cwd, model, command, args, url]);

  const selectedModel = (adapterModels ?? []).find((m) => m.id === model);
  const hasAnthropicApiKeyOverrideCheck =
    adapterEnvResult?.checks.some(
      (check) =>
        check.code === "claude_anthropic_api_key_overrides_subscription"
    ) ?? false;
  const shouldSuggestUnsetAnthropicApiKey =
    adapterType === "claude_local" &&
    adapterEnvResult?.status === "fail" &&
    hasAnthropicApiKeyOverrideCheck;
  const filteredModels = useMemo(() => {
    const query = modelSearch.trim().toLowerCase();
    return (adapterModels ?? []).filter((entry) => {
      if (!query) return true;
      const provider = extractProviderIdWithFallback(entry.id, "");
      return (
        entry.id.toLowerCase().includes(query) ||
        entry.label.toLowerCase().includes(query) ||
        provider.toLowerCase().includes(query)
      );
    });
  }, [adapterModels, modelSearch]);
  const groupedModels = useMemo(() => {
    if (adapterType !== "opencode_local") {
      return [
        {
          provider: "models",
          entries: [...filteredModels].sort((a, b) => a.id.localeCompare(b.id)),
        },
      ];
    }
    const groups = new Map<string, Array<{ id: string; label: string }>>();
    for (const entry of filteredModels) {
      const provider = extractProviderIdWithFallback(entry.id);
      const bucket = groups.get(provider) ?? [];
      bucket.push(entry);
      groups.set(provider, bucket);
    }
    return Array.from(groups.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([provider, entries]) => ({
        provider,
        entries: [...entries].sort((a, b) => a.id.localeCompare(b.id)),
      }));
  }, [filteredModels, adapterType]);

  function reset() {
    setStep(1);
    setLoading(false);
    setError(null);
    setCompanyName("");
    setCompanyGoal("");
    setAgentName(DEFAULT_PRIMARY_AGENT_NAME);
    setAdapterType("openclaw");
    setCwd("");
    setModel("");
    setCommand("");
    setArgs("");
    setUrl("");
    setAdapterEnvResult(null);
    setAdapterEnvError(null);
    setAdapterEnvLoading(false);
    setForceUnsetAnthropicApiKey(false);
    setUnsetAnthropicLoading(false);
    setSelectedSecretId(null);
    setInlineSecretName("");
    setInlineSecretValue("");
    setInlineSecretOpen(false);
    setTaskTitle(DEFAULT_PRIMARY_TASK_TITLE);
    setTaskDescription(DEFAULT_TASK_DESCRIPTION);
    setCreatedCompanyId(null);
    setCreatedCompanyPrefix(null);
    setCreatedAgentId(null);
    setCreatedIssueRef(null);
  }

  function handleClose() {
    reset();
    closeOnboarding();
  }

  function buildAdapterConfig(): Record<string, unknown> {
    const adapter = getUIAdapter(adapterType);
    const config = adapter.buildAdapterConfig({
      ...defaultCreateValues,
      adapterType,
      cwd,
      model:
        adapterType === "codex_local"
          ? model || DEFAULT_CODEX_LOCAL_MODEL
          : adapterType === "cursor"
            ? model || DEFAULT_CURSOR_LOCAL_MODEL
            : model,
      command,
      args,
      url,
      dangerouslySkipPermissions: adapterType === "claude_local",
      dangerouslyBypassSandbox:
        adapterType === "codex_local"
          ? DEFAULT_CODEX_LOCAL_BYPASS_APPROVALS_AND_SANDBOX
          : defaultCreateValues.dangerouslyBypassSandbox
    });

    if (adapterType === "openclaw") {
      const workspaceRoot = cwd.trim() || DEFAULT_OPENCLAW_WORKSPACE;
      const normalizedAgentSlug =
        agentName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") ||
        DEFAULT_PRIMARY_AGENT_ROLE;
      const pathSeparator = workspaceRoot.includes("\\") ? "\\" : "/";
      const normalizedWorkspaceRoot = workspaceRoot.replace(/[\\/]+$/, "");
      const agentWorkspace = `${normalizedWorkspaceRoot}${pathSeparator}${normalizedAgentSlug}`;

      config.url = normalizeOpenClawGatewayUrl(url);
      config.workspacePath = agentWorkspace;
      config.workspaceRoot = agentWorkspace;
      config.openclawWorkspace = agentWorkspace;
      config.cwd = agentWorkspace;
      config.instructionsFilePath = `${agentWorkspace}${pathSeparator}SOUL.md`;
      config.agentsMdPath = `${agentWorkspace}${pathSeparator}AGENTS.md`;
    }

    if (selectedSecretId) {
      const env =
        typeof config.env === "object" &&
        config.env !== null &&
        !Array.isArray(config.env)
          ? { ...(config.env as Record<string, unknown>) }
          : {};
      const selectedSecret = availableSecrets.find((s) => s.id === selectedSecretId);
      if (selectedSecret) {
        env[selectedSecret.name] = {
          type: "secret_ref",
          secretId: selectedSecretId,
          version: "latest",
        };
      }
      config.env = env;
    }

    if (adapterType === "claude_local" && forceUnsetAnthropicApiKey) {
      const env =
        typeof config.env === "object" &&
        config.env !== null &&
        !Array.isArray(config.env)
          ? { ...(config.env as Record<string, unknown>) }
          : {};
      env.ANTHROPIC_API_KEY = { type: "plain", value: "" };
      config.env = env;
    }
    return config;
  }

  async function runAdapterEnvironmentTest(
    adapterConfigOverride?: Record<string, unknown>
  ): Promise<AdapterEnvironmentTestResult | null> {
    if (!createdCompanyId) {
      setAdapterEnvError(
        "Create or select a company before testing adapter environment."
      );
      return null;
    }
    setAdapterEnvLoading(true);
    setAdapterEnvError(null);
    try {
      const result = await agentsApi.testEnvironment(
        createdCompanyId,
        adapterType,
        {
          adapterConfig: adapterConfigOverride ?? buildAdapterConfig()
        }
      );
      setAdapterEnvResult(result);
      return result;
    } catch (err) {
      setAdapterEnvError(
        err instanceof Error ? err.message : "Adapter environment test failed"
      );
      return null;
    } finally {
      setAdapterEnvLoading(false);
    }
  }

  async function handleStep1Next() {
    if (loading) return; // prevent double-submit
    setLoading(true);
    setError(null);
    try {
      // Idempotency: if company was already created (e.g. retry after goal failure), skip creation
      let companyId = createdCompanyId;
      let companyPrefix = createdCompanyPrefix;
      if (!companyId) {
        // Check if a company with this name already exists (idempotency)
        const existing = companies.find(
          (c) =>
            c.status !== "archived" &&
            c.name.trim().toLowerCase() === companyName.trim().toLowerCase()
        );
        if (existing) {
          companyId = existing.id;
          companyPrefix = existing.issuePrefix;
        } else {
          const company = await companiesApi.create({ name: companyName.trim() });
          companyId = company.id;
          companyPrefix = company.issuePrefix;
        }
        setCreatedCompanyId(companyId);
        setCreatedCompanyPrefix(companyPrefix);
        setSelectedCompanyId(companyId);
        queryClient.invalidateQueries({ queryKey: queryKeys.companies.all });
      }

      if (companyGoal.trim()) {
        try {
          await goalsApi.create(companyId, {
            title: companyGoal.trim(),
            level: "company",
            status: "active"
          });
          queryClient.invalidateQueries({
            queryKey: queryKeys.goals.list(companyId)
          });
        } catch (goalErr) {
          // Goal creation is non-critical; company was created successfully
          console.warn("Goal creation failed (non-critical):", goalErr);
        }
      }

      setStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create company");
    } finally {
      setLoading(false);
    }
  }

  async function handleStep2Next() {
    if (!createdCompanyId || loading) return;
    setLoading(true);
    setError(null);
    try {
      if (adapterType === "opencode_local") {
        const selectedModelId = model.trim();
        if (!selectedModelId) {
          setError("OpenCode requires an explicit model. Select one from the dropdown in provider/model format (e.g. anthropic/claude-sonnet-4-5-20250929).");
          return;
        }
        if (adapterModelsError) {
          const msg = adapterModelsError instanceof Error
            ? adapterModelsError.message
            : "Failed to load OpenCode models.";
          setError(`${msg} -- Ensure OpenCode is installed and at least one provider is authenticated. Run: opencode auth login`);
          return;
        }
        if (adapterModelsLoading || adapterModelsFetching) {
          setError("OpenCode models are still loading. Please wait and try again.");
          return;
        }
        const discoveredModels = adapterModels ?? [];
        if (!discoveredModels.some((entry) => entry.id === selectedModelId)) {
          setError(
            discoveredModels.length === 0
              ? "No OpenCode models discovered. Steps to fix:\n1. Ensure OpenCode is installed: npm install -g opencode\n2. Authenticate a provider: opencode auth login\n3. Add a provider API key (e.g. ANTHROPIC_API_KEY) as a secret above"
              : `Model not available: ${selectedModelId}. It may require provider authentication. Add the provider's API key as a secret or run opencode auth login.`,
          );
          return;
        }
      }

      if (adapterType === "openclaw") {
        const gatewayUrl = normalizeOpenClawGatewayUrl(url);
        try {
          new URL(gatewayUrl);
        } catch {
          setError("Invalid OpenClaw gateway URL. Please enter a valid URL (e.g. http://host.docker.internal:18789).");
          return;
        }
        // Quick connectivity check — just verify the URL is reachable
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000);
          await fetch(gatewayUrl, {
            method: "HEAD",
            signal: controller.signal,
            mode: "no-cors",
          }).finally(() => clearTimeout(timeoutId));
        } catch (err) {
          // no-cors fetch will throw on network errors but succeed on any response
          if (err instanceof DOMException && err.name === "AbortError") {
            setError(`Cannot reach OpenClaw gateway at ${gatewayUrl}. Check that the gateway is running and accessible.`);
            return;
          }
          // Other fetch errors in no-cors mode are expected (opaque response), so continue
        }
      }

      if (isLocalAdapter) {
        const result = adapterEnvResult ?? (await runAdapterEnvironmentTest());
        if (!result) return;
        if (result.status === "fail") {
          setError("Fix the adapter validation errors before continuing.");
          return;
        }
      }

      // Idempotency: if agent was already created (e.g. retry), skip creation
      if (!createdAgentId) {
        const agent = await agentsApi.create(createdCompanyId, {
          name: agentName.trim(),
          role: DEFAULT_PRIMARY_AGENT_ROLE,
          adapterType,
          adapterConfig: buildAdapterConfig(),
          runtimeConfig: {
            heartbeat: {
              enabled: true,
              intervalSec: 3600,
              wakeOnDemand: true,
              cooldownSec: 10,
              maxConcurrentRuns: 1
            }
          }
        });
        setCreatedAgentId(agent.id);
        queryClient.invalidateQueries({
          queryKey: queryKeys.agents.list(createdCompanyId)
        });
      }
      setStep(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create agent");
    } finally {
      setLoading(false);
    }
  }

  async function handleUnsetAnthropicApiKey() {
    if (!createdCompanyId || unsetAnthropicLoading) return;
    setUnsetAnthropicLoading(true);
    setError(null);
    setAdapterEnvError(null);
    setForceUnsetAnthropicApiKey(true);

    const configWithUnset = (() => {
      const config = buildAdapterConfig();
      const env =
        typeof config.env === "object" &&
        config.env !== null &&
        !Array.isArray(config.env)
          ? { ...(config.env as Record<string, unknown>) }
          : {};
      env.ANTHROPIC_API_KEY = { type: "plain", value: "" };
      config.env = env;
      return config;
    })();

    try {
      if (createdAgentId) {
        await agentsApi.update(
          createdAgentId,
          { adapterConfig: configWithUnset },
          createdCompanyId
        );
        queryClient.invalidateQueries({
          queryKey: queryKeys.agents.list(createdCompanyId)
        });
      }

      const result = await runAdapterEnvironmentTest(configWithUnset);
      if (result?.status === "fail") {
        setError(
          "Retried with ANTHROPIC_API_KEY unset in adapter config, but the environment test is still failing."
        );
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to unset ANTHROPIC_API_KEY and retry."
      );
    } finally {
      setUnsetAnthropicLoading(false);
    }
  }

  async function handleStep3Next() {
    if (!createdCompanyId || !createdAgentId || loading) return;
    setLoading(true);
    setError(null);
    try {
      // Idempotency: if issue was already created, skip
      if (!createdIssueRef) {
        const issue = await issuesApi.create(createdCompanyId, {
          title: taskTitle.trim(),
          ...(taskDescription.trim()
            ? { description: taskDescription.trim() }
            : {}),
          assigneeAgentId: createdAgentId,
          status: "todo"
        });
        setCreatedIssueRef(issue.identifier ?? issue.id);
        queryClient.invalidateQueries({
          queryKey: queryKeys.issues.list(createdCompanyId)
        });
      }
      setStep(4);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create task");
    } finally {
      setLoading(false);
    }
  }

  async function handleLaunch() {
    if (!createdAgentId) return;
    setLoading(true);
    setError(null);
    setLoading(false);
    reset();
    closeOnboarding();
    if (createdCompanyPrefix && createdIssueRef) {
      navigate(`/${createdCompanyPrefix}/issues/${createdIssueRef}`);
      return;
    }
    if (createdCompanyPrefix) {
      navigate(`/${createdCompanyPrefix}/dashboard`);
      return;
    }
    navigate("/dashboard");
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      if (loading) return; // prevent double-fire
      if (step === 1 && companyName.trim()) handleStep1Next();
      else if (step === 2 && agentName.trim()) handleStep2Next();
      else if (step === 3 && taskTitle.trim()) handleStep3Next();
      else if (step === 4) handleLaunch();
    }
  }

  if (!onboardingOpen) return null;

  return (
    <Dialog
      open={onboardingOpen}
      onOpenChange={(open) => {
        if (!open) handleClose();
      }}
    >
      <DialogPortal>
        {/* Plain div instead of DialogOverlay — Radix's overlay wraps in
            RemoveScroll which blocks wheel events on our custom (non-DialogContent)
            scroll container. A plain div preserves the background without scroll-locking. */}
        <div className="fixed inset-0 z-50 bg-background" />
        <div className="fixed inset-0 z-50 flex" onKeyDown={handleKeyDown}>
          {/* Close button */}
          <button
            onClick={handleClose}
            className="absolute top-4 left-4 z-10 rounded-sm p-1.5 text-muted-foreground/60 hover:text-foreground transition-colors"
          >
            <X className="h-5 w-5" />
            <span className="sr-only">Close</span>
          </button>

          {/* Left half — form */}
          <div className="w-full md:w-1/2 flex flex-col overflow-y-auto">
            <div className="w-full max-w-md mx-auto my-auto px-8 py-12 shrink-0">
              {/* Progress indicators */}
              <div className="flex items-center gap-2 mb-8">
                <Sparkles className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Get Started</span>
                <span className="text-sm text-muted-foreground/60">
                  Step {step} of 4
                  {step === 1 && " - Company"}
                  {step === 2 && " - Agent"}
                  {step === 3 && " - Task"}
                  {step === 4 && " - Launch"}
                </span>
                <div className="flex items-center gap-1.5 ml-auto">
                  {[1, 2, 3, 4].map((s) => (
                    <div
                      key={s}
                      className={cn(
                        "h-1.5 w-6 rounded-full transition-colors",
                        s < step
                          ? "bg-green-500"
                          : s === step
                            ? "bg-foreground"
                            : "bg-muted"
                      )}
                    />
                  ))}
                </div>
              </div>

              {/* Step content */}
              {step === 1 && (
                <div className="space-y-5">
                  <div className="flex items-center gap-3 mb-1">
                    <div className="bg-muted/50 p-2">
                      <Building2 className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <h3 className="font-medium">Name your company</h3>
                      <p className="text-xs text-muted-foreground">
                        This is the organization your agents will work for.
                      </p>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">
                      Company name
                    </label>
                    <input
                      className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50"
                      placeholder="Acme Corp"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">
                      Mission / goal (optional)
                    </label>
                    <textarea
                      className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50 resize-none min-h-[60px]"
                      placeholder="What is this company trying to achieve?"
                      value={companyGoal}
                      onChange={(e) => setCompanyGoal(e.target.value)}
                    />
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-5">
                  <div className="flex items-center gap-3 mb-1">
                    <div className="bg-muted/50 p-2">
                      <Bot className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <h3 className="font-medium">Create your first agent</h3>
                      <p className="text-xs text-muted-foreground">
                        Choose how this agent will run tasks.
                      </p>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">
                      Agent name
                    </label>
                    <input
                      className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50"
                      placeholder={DEFAULT_PRIMARY_AGENT_NAME}
                      value={agentName}
                      onChange={(e) => setAgentName(e.target.value)}
                      autoFocus
                    />
                  </div>

                  {/* Adapter type radio cards */}
                  <div>
                    <label className="text-xs text-muted-foreground mb-2 block">
                      Adapter type
                    </label>
                    <p className="mb-3 text-[11px] text-muted-foreground">
                      For this setup flow, start with <span className="font-medium text-foreground">OpenClaw</span> as the runtime workspace. You can still use Claude, Codex, Cursor, or OpenCode later, but this path is optimized for provisioning a workspace-backed company first.
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        {
                          value: "openclaw" as const,
                          label: "OpenClaw",
                          icon: Bot,
                          desc: "Primary runtime workspace for setup",
                          recommended: true
                        },
                        {
                          value: "claude_local" as const,
                          label: "Claude Code",
                          icon: Sparkles,
                          desc: "Use Claude alongside the OpenClaw workspace"
                        },
                        {
                          value: "codex_local" as const,
                          label: "Codex",
                          icon: Code,
                          desc: "Alternative local coding agent"
                        },
                        {
                          value: "opencode_local" as const,
                          label: "OpenCode",
                          icon: OpenCodeLogoIcon,
                          desc: "Local multi-provider agent"
                        },
                        {
                          value: "cursor" as const,
                          label: "Cursor",
                          icon: MousePointer2,
                          desc: "Local Cursor agent"
                        },
                        {
                          value: "process" as const,
                          label: "Shell Command",
                          icon: Terminal,
                          desc: "Run a process",
                          comingSoon: true
                        },
                        {
                          value: "http" as const,
                          label: "HTTP Webhook",
                          icon: Globe,
                          desc: "Call an endpoint",
                          comingSoon: true
                        }
                      ].map((opt) => (
                        <button
                          key={opt.value}
                          disabled={!!opt.comingSoon}
                          className={cn(
                            "flex flex-col items-center gap-1.5 rounded-md border p-3 text-xs transition-colors relative",
                            opt.comingSoon
                              ? "border-border opacity-40 cursor-not-allowed"
                              : adapterType === opt.value
                                ? "border-foreground bg-accent"
                                : "border-border hover:bg-accent/50"
                          )}
                          onClick={() => {
                            if (opt.comingSoon) return;
                            const nextType = opt.value as AdapterType;
                            setAdapterType(nextType);
                            if (nextType === "openclaw" && !cwd) {
                              setCwd(DEFAULT_OPENCLAW_WORKSPACE);
                            }
                            if (nextType === "openclaw" && !url) {
                              setUrl(DEFAULT_OPENCLAW_GATEWAY_URL);
                            }
                            if (nextType === "codex_local" && !model) {
                              setModel(DEFAULT_CODEX_LOCAL_MODEL);
                            } else if (nextType === "cursor" && !model) {
                              setModel(DEFAULT_CURSOR_LOCAL_MODEL);
                            }
                            if (nextType === "opencode_local") {
                              if (!model.includes("/")) {
                                setModel("");
                              }
                              return;
                            }
                            setModel("");
                          }}
                        >
                          {opt.recommended && (
                            <span className="absolute -top-1.5 -right-1.5 bg-green-500 text-white text-[9px] font-semibold px-1.5 py-0.5 rounded-full leading-none">
                              Recommended
                            </span>
                          )}
                          <opt.icon className="h-4 w-4" />
                          <span className="font-medium">{opt.label}</span>
                          <span className="text-muted-foreground text-[10px]">
                            {opt.comingSoon ? "Coming soon" : opt.desc}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Conditional adapter fields */}
                  {adapterType === "openclaw" && (
                    <div className="space-y-3 rounded-md border border-border p-3">
                      <div>
                        <div className="flex items-center gap-1.5 mb-1">
                          <label className="text-xs text-muted-foreground">
                            OpenClaw workspace root
                          </label>
                          <HintIcon text="Point this at the host-mounted OpenClaw workspace directory so Paperclip can inspect and coordinate the generated agent folders." />
                        </div>
                        <div className="flex items-center gap-2 rounded-md border border-border px-2.5 py-1.5">
                          <FolderOpen className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <input
                            className="w-full bg-transparent outline-none text-sm font-mono placeholder:text-muted-foreground/50"
                            placeholder={DEFAULT_OPENCLAW_WORKSPACE}
                            value={cwd}
                            onChange={(e) => setCwd(e.target.value)}
                          />
                          <ChoosePathButton />
                        </div>
                      </div>

                      <div className="rounded-md border border-blue-300/40 bg-blue-50/40 dark:border-blue-900/40 dark:bg-blue-950/20 px-3 py-2 text-[11px] text-blue-900 dark:text-blue-100">
                        <p className="font-medium">Recommended setup path</p>
                        <p className="mt-1 text-blue-800/90 dark:text-blue-100/80">
                          Use OpenClaw as the primary runtime workspace, then add your <span className="font-mono">ANTHROPIC_API_KEY</span> below so Claude can help inspect, validate, and complete the setup flow.
                        </p>
                      </div>

                      <div className="rounded-md border border-amber-300/50 bg-amber-50/40 dark:border-amber-900/40 dark:bg-amber-950/20 px-3 py-2 text-[11px] text-amber-950 dark:text-amber-100 space-y-2">
                        <p className="font-medium">Connecting OpenClaw from Docker</p>
                        <p className="text-amber-900/90 dark:text-amber-100/80">
                          If Paperclip is running in Docker, this path must be a workspace location the Paperclip container can actually see. If Developer Mode shows no files, the most common cause is that the OpenClaw workspace is not mounted into the container at the path you entered here.
                        </p>
                        <div className="space-y-1 text-amber-900/90 dark:text-amber-100/80">
                          <p>
                            - Gateway URL: use the OpenClaw endpoint reachable from the Paperclip container or browser. Local default is <span className="font-mono">http://127.0.0.1:18789</span>, but in Docker this may need to be a container hostname or mapped host URL.
                          </p>
                          <p>
                            - Workspace path: enter the mounted path visible to Paperclip, not just the host-machine path, if those differ.
                          </p>
                          <p>
                            - Developer Mode files: the file tree only appears when the selected agent&apos;s <span className="font-mono">workspacePath</span>/<span className="font-mono">cwd</span> resolves to a real directory the server can read.
                          </p>
                        </div>
                        <a
                          className="inline-flex text-[11px] underline underline-offset-2 hover:no-underline"
                          href="/developer-mode"
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open Developer Mode to verify whether the workspace is readable
                        </a>
                      </div>
                    </div>
                  )}

                  {(adapterType === "claude_local" ||
                    adapterType === "codex_local" ||
                    adapterType === "opencode_local" ||
                    adapterType === "cursor") && (
                    <div className="space-y-3">
                      <div>
                        <div className="flex items-center gap-1.5 mb-1">
                          <label className="text-xs text-muted-foreground">
                            Working directory
                          </label>
                          <HintIcon text="Paperclip works best if you create a new folder for your agents to keep their memories and stay organized. Create a new folder and put the path here." />
                        </div>
                        <div className="flex items-center gap-2 rounded-md border border-border px-2.5 py-1.5">
                          <FolderOpen className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <input
                            className="w-full bg-transparent outline-none text-sm font-mono placeholder:text-muted-foreground/50"
                            placeholder="/path/to/project"
                            value={cwd}
                            onChange={(e) => setCwd(e.target.value)}
                          />
                          <ChoosePathButton />
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">
                          Model
                        </label>
                        <Popover
                          open={modelOpen}
                          onOpenChange={(next) => {
                            setModelOpen(next);
                            if (!next) setModelSearch("");
                          }}
                        >
                          <PopoverTrigger asChild>
                            <button className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-sm hover:bg-accent/50 transition-colors w-full justify-between">
                              <span
                                className={cn(
                                  !model && "text-muted-foreground"
                                )}
                              >
                                {selectedModel
                                  ? selectedModel.label
                                  : model ||
                                    (adapterType === "opencode_local"
                                      ? "Select model (required)"
                                      : "Default")}
                              </span>
                              <ChevronDown className="h-3 w-3 text-muted-foreground" />
                            </button>
                          </PopoverTrigger>
                          <PopoverContent
                            className="w-[var(--radix-popover-trigger-width)] p-1"
                            align="start"
                          >
                            <input
                              className="w-full px-2 py-1.5 text-xs bg-transparent outline-none border-b border-border mb-1 placeholder:text-muted-foreground/50"
                              placeholder="Search models..."
                              value={modelSearch}
                              onChange={(e) => setModelSearch(e.target.value)}
                              autoFocus
                            />
                            {adapterType !== "opencode_local" && (
                              <button
                                className={cn(
                                  "flex items-center gap-2 w-full px-2 py-1.5 text-sm rounded hover:bg-accent/50",
                                  !model && "bg-accent"
                                )}
                                onClick={() => {
                                  setModel("");
                                  setModelOpen(false);
                                }}
                              >
                                  Default
                                </button>
                            )}
                            <div className="max-h-[240px] overflow-y-auto">
                              {groupedModels.map((group) => (
                                <div key={group.provider} className="mb-1 last:mb-0">
                                  {adapterType === "opencode_local" && (
                                    <div className="px-2 py-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                                      {group.provider} ({group.entries.length})
                                    </div>
                                  )}
                                  {group.entries.map((m) => (
                                    <button
                                      key={m.id}
                                      className={cn(
                                        "flex items-center w-full px-2 py-1.5 text-sm rounded hover:bg-accent/50",
                                        m.id === model && "bg-accent"
                                      )}
                                      onClick={() => {
                                        setModel(m.id);
                                        setModelOpen(false);
                                      }}
                                    >
                                      <span className="block w-full text-left truncate" title={m.id}>
                                        {adapterType === "opencode_local" ? extractModelName(m.id) : m.label}
                                      </span>
                                    </button>
                                  ))}
                                </div>
                              ))}
                            </div>
                            {filteredModels.length === 0 && (
                              <p className="px-2 py-1.5 text-xs text-muted-foreground">
                                No models discovered.
                              </p>
                            )}
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>
                  )}

                  {/* API Key / Secret Reference */}
                  {(isLocalAdapter || adapterType === "openclaw") && (
                    <div className="space-y-2 rounded-md border border-border p-3">
                      <div className="flex items-center gap-2">
                        <Key className="h-3.5 w-3.5 text-muted-foreground" />
                        <p className="text-xs font-medium">Credentials</p>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        {adapterType === "openclaw"
                          ? "OpenClaw itself uses the mounted workspace, but Claude-assisted setup still benefits from an ANTHROPIC_API_KEY secret so Paperclip can help you configure and inspect the system."
                          : adapterType === "claude_local"
                          ? "If you use CLI login (claude login), no API key is needed. Add one only for direct API access."
                          : adapterType === "opencode_local"
                            ? "OpenCode providers need API keys. Select an existing secret or create one."
                            : "Select an existing API key secret or create one for this adapter."}
                      </p>
                      {availableSecrets.length > 0 ? (
                        <select
                          className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm outline-none"
                          value={selectedSecretId ?? ""}
                          onChange={(e) => setSelectedSecretId(e.target.value || null)}
                        >
                          <option value="">
                            {adapterType === "claude_local" ? "None (use CLI login)" : adapterType === "openclaw" ? "None yet" : "None"}
                          </option>
                          {availableSecrets.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name} (v{s.latestVersion})
                            </option>
                          ))}
                        </select>
                      ) : (
                        <p className="text-[11px] text-muted-foreground/60">
                          No secrets stored yet.
                        </p>
                      )}
                      {!inlineSecretOpen ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2.5 text-xs"
                          onClick={() => {
                            setInlineSecretOpen(true);
                            setInlineSecretName(
                              adapterType === "openclaw"
                                ? "ANTHROPIC_API_KEY"
                                : adapterType === "claude_local"
                                ? "ANTHROPIC_API_KEY"
                                : adapterType === "opencode_local"
                                  ? "OPENAI_API_KEY"
                                  : "OPENAI_API_KEY"
                            );
                          }}
                        >
                          Create API Key
                        </Button>
                      ) : (
                        <div className="space-y-2 rounded-md border border-border/70 bg-muted/20 p-2.5">
                          <div>
                            <label className="text-[11px] text-muted-foreground mb-0.5 block">Name</label>
                            <select
                              className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs outline-none"
                              value={inlineSecretName}
                              onChange={(e) => setInlineSecretName(e.target.value)}
                            >
                              {["ANTHROPIC_API_KEY", "OPENAI_API_KEY", "OPENROUTER_API_KEY", "GOOGLE_API_KEY"].map(
                                (name) => (
                                  <option
                                    key={name}
                                    value={name}
                                    disabled={availableSecrets.some((s) => s.name === name)}
                                  >
                                    {name}{availableSecrets.some((s) => s.name === name) ? " (exists)" : ""}
                                  </option>
                                )
                              )}
                            </select>
                          </div>
                          <div>
                            <label className="text-[11px] text-muted-foreground mb-0.5 block">Value</label>
                            <input
                              type="password"
                              className="w-full rounded-md border border-border bg-transparent px-2 py-1 text-xs font-mono outline-none placeholder:text-muted-foreground/40"
                              placeholder="sk-..."
                              value={inlineSecretValue}
                              onChange={(e) => setInlineSecretValue(e.target.value)}
                            />
                          </div>
                          {createSecretMutation.isError && (
                            <p className="text-[11px] text-destructive">
                              {createSecretMutation.error instanceof Error
                                ? createSecretMutation.error.message
                                : "Failed to create secret"}
                            </p>
                          )}
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              className="h-6 px-2 text-[11px]"
                              disabled={!inlineSecretName || !inlineSecretValue.trim() || createSecretMutation.isPending}
                              onClick={() =>
                                createSecretMutation.mutate({
                                  name: inlineSecretName,
                                  value: inlineSecretValue,
                                })
                              }
                            >
                              {createSecretMutation.isPending ? "Saving..." : "Save"}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 px-2 text-[11px]"
                              onClick={() => {
                                setInlineSecretOpen(false);
                                setInlineSecretName("");
                                setInlineSecretValue("");
                              }}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {isLocalAdapter && (
                    <div className="space-y-2 rounded-md border border-border p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-xs font-medium">
                            Adapter environment check
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            Runs a live probe that asks the adapter CLI to
                            respond with hello.
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2.5 text-xs"
                          disabled={adapterEnvLoading}
                          onClick={() => void runAdapterEnvironmentTest()}
                        >
                          {adapterEnvLoading ? "Testing..." : "Test now"}
                        </Button>
                      </div>

                      {adapterEnvError && (
                        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-2.5 py-2 text-[11px] text-destructive">
                          {adapterEnvError}
                        </div>
                      )}

                      {adapterEnvResult && (
                        <AdapterEnvironmentResult result={adapterEnvResult} />
                      )}

                      {shouldSuggestUnsetAnthropicApiKey && (
                        <div className="rounded-md border border-amber-300/60 bg-amber-50/40 px-2.5 py-2 space-y-2">
                          <p className="text-[11px] text-amber-900/90 leading-relaxed">
                            Claude failed while <span className="font-mono">ANTHROPIC_API_KEY</span> is set.
                            You can clear it in this agent adapter config and retry the probe.
                          </p>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2.5 text-xs"
                            disabled={adapterEnvLoading || unsetAnthropicLoading}
                            onClick={() => void handleUnsetAnthropicApiKey()}
                          >
                            {unsetAnthropicLoading ? "Retrying..." : "Unset ANTHROPIC_API_KEY"}
                          </Button>
                        </div>
                      )}

                      <div className="rounded-md border border-border/70 bg-muted/20 px-2.5 py-2 text-[11px] space-y-1.5">
                        <p className="font-medium">Manual debug</p>
                        <p className="text-muted-foreground font-mono break-all">
                          {adapterType === "cursor"
                            ? `${effectiveAdapterCommand} -p --mode ask --output-format json \"Respond with hello.\"`
                            : adapterType === "codex_local"
                            ? `${effectiveAdapterCommand} exec --json -`
                            : adapterType === "opencode_local"
                              ? `${effectiveAdapterCommand} run --format json "Respond with hello."`
                            : `${effectiveAdapterCommand} --print - --output-format stream-json --verbose`}
                        </p>
                        <p className="text-muted-foreground">
                          Prompt:{" "}
                          <span className="font-mono">Respond with hello.</span>
                        </p>
                        {adapterType === "cursor" || adapterType === "codex_local" || adapterType === "opencode_local" ? (
                          <p className="text-muted-foreground">
                            If auth fails, set{" "}
                            <span className="font-mono">
                              {adapterType === "cursor" ? "CURSOR_API_KEY" : "OPENAI_API_KEY"}
                            </span>{" "}
                            in
                            env or run{" "}
                            <span className="font-mono">
                              {adapterType === "cursor"
                                ? "agent login"
                                : adapterType === "codex_local"
                                  ? "codex login"
                                  : "opencode auth login"}
                            </span>.
                          </p>
                        ) : (
                          <p className="text-muted-foreground">
                            If login is required, run{" "}
                            <span className="font-mono">claude login</span> and
                            retry.
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {adapterType === "process" && (
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">
                          Command
                        </label>
                        <input
                          className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm font-mono outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50"
                          placeholder="e.g. node, python"
                          value={command}
                          onChange={(e) => setCommand(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">
                          Args (comma-separated)
                        </label>
                        <input
                          className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm font-mono outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50"
                          placeholder="e.g. script.js, --flag"
                          value={args}
                          onChange={(e) => setArgs(e.target.value)}
                        />
                      </div>
                    </div>
                  )}

                  {(adapterType === "http" || adapterType === "openclaw") && (
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">
                        Webhook URL
                      </label>
                      <input
                        className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm font-mono outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50"
                        placeholder={adapterType === "openclaw" ? DEFAULT_OPENCLAW_GATEWAY_URL : "https://..."}
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                      />
                    </div>
                  )}
                </div>
              )}

              {step === 3 && (
                <div className="space-y-5">
                  <div className="flex items-center gap-3 mb-1">
                    <div className="bg-muted/50 p-2">
                      <ListTodo className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <h3 className="font-medium">Define the primary operator</h3>
                      <p className="text-xs text-muted-foreground">
                        Capture how this Executive Assistant should operate as the primary point of contact for the workspace.
                      </p>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">
                      Task title
                    </label>
                    <input
                      className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50"
                      placeholder={DEFAULT_PRIMARY_TASK_TITLE}
                      value={taskTitle}
                      onChange={(e) => setTaskTitle(e.target.value)}
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">
                      Description (optional)
                    </label>
                    <textarea
                      ref={textareaRef}
                      className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50 resize-none min-h-[120px] max-h-[300px] overflow-y-auto"
                      placeholder="Add more detail about what the agent should do..."
                      value={taskDescription}
                      onChange={(e) => setTaskDescription(e.target.value)}
                    />
                  </div>
                </div>
              )}

              {step === 4 && (
                <div className="space-y-5">
                  <div className="flex items-center gap-3 mb-1">
                    <div className="bg-muted/50 p-2">
                      <Rocket className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <h3 className="font-medium">Ready to launch</h3>
                      <p className="text-xs text-muted-foreground">
                        Everything is set up. Your assigned task already woke
                        the agent, so you can jump straight to the issue.
                      </p>
                    </div>
                  </div>
                  <div className="border border-border divide-y divide-border">
                    <div className="flex items-center gap-3 px-3 py-2.5">
                      <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {companyName}
                        </p>
                        <p className="text-xs text-muted-foreground">Company</p>
                      </div>
                      <Check className="h-4 w-4 text-green-500 shrink-0" />
                    </div>
                    <div className="flex items-center gap-3 px-3 py-2.5">
                      <Bot className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {agentName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {getUIAdapter(adapterType).label}
                        </p>
                      </div>
                      <Check className="h-4 w-4 text-green-500 shrink-0" />
                    </div>
                    <div className="flex items-center gap-3 px-3 py-2.5">
                      <ListTodo className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {taskTitle}
                        </p>
                        <p className="text-xs text-muted-foreground">Task</p>
                      </div>
                      <Check className="h-4 w-4 text-green-500 shrink-0" />
                    </div>
                  </div>
                </div>
              )}

              {/* Error with retry */}
              {error && (
                <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2.5 space-y-2">
                  <p className="text-xs text-destructive">{error}</p>
                  <button
                    className="text-xs text-destructive underline hover:no-underline"
                    disabled={loading}
                    onClick={() => {
                      setError(null);
                      if (step === 1) handleStep1Next();
                      else if (step === 2) handleStep2Next();
                      else if (step === 3) handleStep3Next();
                    }}
                  >
                    {loading ? "Retrying..." : "Retry"}
                  </button>
                </div>
              )}

              {/* Partial failure recovery: company created but stuck on step 1 */}
              {step === 1 && createdCompanyId && !error && (
                <div className="mt-3 rounded-md border border-amber-300/60 bg-amber-50/40 dark:bg-amber-500/10 px-3 py-2.5">
                  <p className="text-xs text-amber-900/90 dark:text-amber-300">
                    Company already created. You can continue setup.
                  </p>
                  <button
                    className="text-xs text-amber-700 dark:text-amber-400 underline hover:no-underline mt-1"
                    onClick={() => setStep(2)}
                  >
                    Continue to agent setup
                  </button>
                </div>
              )}

              {/* Footer navigation */}
              <div className="flex items-center justify-between mt-8">
                <div>
                  {step > 1 && step > (onboardingOptions.initialStep ?? 1) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setStep((step - 1) as Step)}
                      disabled={loading}
                    >
                      <ArrowLeft className="h-3.5 w-3.5 mr-1" />
                      Back
                    </Button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {step === 1 && (
                    <Button
                      size="sm"
                      disabled={!companyName.trim() || loading}
                      onClick={handleStep1Next}
                    >
                      {loading ? (
                        <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                      ) : (
                        <ArrowRight className="h-3.5 w-3.5 mr-1" />
                      )}
                      {loading ? "Creating..." : "Next"}
                    </Button>
                  )}
                  {step === 2 && (
                    <Button
                      size="sm"
                      disabled={
                        !agentName.trim() || loading || adapterEnvLoading
                      }
                      onClick={handleStep2Next}
                    >
                      {loading ? (
                        <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                      ) : (
                        <ArrowRight className="h-3.5 w-3.5 mr-1" />
                      )}
                      {loading ? "Creating..." : "Next"}
                    </Button>
                  )}
                  {step === 3 && (
                    <Button
                      size="sm"
                      disabled={!taskTitle.trim() || loading}
                      onClick={handleStep3Next}
                    >
                      {loading ? (
                        <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                      ) : (
                        <ArrowRight className="h-3.5 w-3.5 mr-1" />
                      )}
                      {loading ? "Creating..." : "Next"}
                    </Button>
                  )}
                  {step === 4 && (
                    <Button size="sm" disabled={loading} onClick={handleLaunch}>
                      {loading ? (
                        <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                      ) : (
                        <ArrowRight className="h-3.5 w-3.5 mr-1" />
                      )}
                      {loading ? "Opening..." : "Open Issue"}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Right half — ASCII art (hidden on mobile) */}
          <div className="hidden md:block w-1/2 overflow-hidden">
            <AsciiArtAnimation />
          </div>
        </div>
      </DialogPortal>
    </Dialog>
  );
}

function AdapterEnvironmentResult({
  result
}: {
  result: AdapterEnvironmentTestResult;
}) {
  const statusLabel =
    result.status === "pass"
      ? "Passed"
      : result.status === "warn"
        ? "Warnings"
        : "Failed";
  const statusClass =
    result.status === "pass"
      ? "text-green-700 dark:text-green-300 border-green-300 dark:border-green-500/40 bg-green-50 dark:bg-green-500/10"
      : result.status === "warn"
        ? "text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-500/10"
        : "text-red-700 dark:text-red-300 border-red-300 dark:border-red-500/40 bg-red-50 dark:bg-red-500/10";

  return (
    <div className={`rounded-md border px-2.5 py-2 text-[11px] ${statusClass}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium">{statusLabel}</span>
        <span className="opacity-80">
          {new Date(result.testedAt).toLocaleTimeString()}
        </span>
      </div>
      <div className="mt-1.5 space-y-1">
        {result.checks.map((check, idx) => (
          <div
            key={`${check.code}-${idx}`}
            className="leading-relaxed break-words"
          >
            <span className="font-medium uppercase tracking-wide opacity-80">
              {check.level}
            </span>
            <span className="mx-1 opacity-60">·</span>
            <span>{check.message}</span>
            {check.detail && (
              <span className="block opacity-75 break-all">
                ({check.detail})
              </span>
            )}
            {check.hint && (
              <span className="block opacity-90 break-words">
                Hint: {check.hint}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
