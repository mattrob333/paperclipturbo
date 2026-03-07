import type { WorkspaceTree, FileContent } from "@paperclipai/shared";
import { api } from "./client";

export const workspaceApi = {
  tree: (companyId: string, agentId: string, path?: string, depth?: number) => {
    const params = new URLSearchParams();
    if (path) params.set("path", path);
    if (depth != null) params.set("depth", String(depth));
    const qs = params.toString();
    return api.get<WorkspaceTree>(
      `/companies/${encodeURIComponent(companyId)}/agents/${encodeURIComponent(agentId)}/workspace/tree${qs ? `?${qs}` : ""}`,
    );
  },

  file: (companyId: string, agentId: string, filePath: string) =>
    api.get<FileContent>(
      `/companies/${encodeURIComponent(companyId)}/agents/${encodeURIComponent(agentId)}/workspace/file?path=${encodeURIComponent(filePath)}`,
    ),
};
