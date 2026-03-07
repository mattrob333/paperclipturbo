import { useQuery } from "@tanstack/react-query";
import type { WorkspaceTree, FileContent } from "@paperclipai/shared";
import { useCompany } from "@/context/CompanyContext";
import { workspaceApi } from "@/api/workspace";

export function useWorkspaceTree(agentId: string | null, path?: string, depth?: number) {
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id ?? null;

  return useQuery<WorkspaceTree>({
    queryKey: ["workspace-tree", companyId, agentId, path ?? "", depth ?? 3],
    queryFn: () => workspaceApi.tree(companyId!, agentId!, path, depth),
    enabled: Boolean(companyId && agentId),
    staleTime: 30_000,
    retry: false,
  });
}

export function useFileContent(agentId: string | null, filePath: string | null) {
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id ?? null;

  return useQuery<FileContent>({
    queryKey: ["workspace-file", companyId, agentId, filePath],
    queryFn: () => workspaceApi.file(companyId!, agentId!, filePath!),
    enabled: Boolean(companyId && agentId && filePath),
    staleTime: 15_000,
    retry: false,
  });
}
