import { useQuery } from "@tanstack/react-query";
import type { AgentRuntimeProfile, ValidationItem, ConfigDiffResult } from "@paperclipai/shared";
import { useCompany } from "@/context/CompanyContext";
import { runtimeApi } from "@/api/runtime";

export function useAgentRuntime(agentId: string | null | undefined) {
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id ?? null;

  return useQuery<AgentRuntimeProfile>({
    queryKey: ["agent-runtime", companyId, agentId],
    queryFn: () => runtimeApi.getRuntime(companyId!, agentId!),
    enabled: Boolean(companyId) && Boolean(agentId),
    refetchInterval: 30_000,
    staleTime: 10_000,
    retry: false,
  });
}

export function useAgentValidation(agentId: string | null | undefined) {
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id ?? null;

  return useQuery<ValidationItem[]>({
    queryKey: ["agent-validation", companyId, agentId],
    queryFn: () => runtimeApi.getValidation(companyId!, agentId!),
    enabled: Boolean(companyId) && Boolean(agentId),
    staleTime: 30_000,
    retry: false,
  });
}

export function useConfigDiff(agentId: string | null | undefined, revisionId?: string) {
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id ?? null;

  return useQuery<ConfigDiffResult>({
    queryKey: ["config-diff", companyId, agentId, revisionId],
    queryFn: () => runtimeApi.getConfigDiff(companyId!, agentId!, revisionId),
    enabled: Boolean(companyId) && Boolean(agentId),
    staleTime: 30_000,
    retry: false,
  });
}
