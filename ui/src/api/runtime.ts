import type {
  AgentRuntimeProfile,
  ValidationItem,
  ConfigDiffResult,
} from "@paperclipai/shared";
import { api } from "./client";

export const runtimeApi = {
  getRuntime: (companyId: string, agentId: string) =>
    api.get<AgentRuntimeProfile>(
      `/companies/${encodeURIComponent(companyId)}/agents/${encodeURIComponent(agentId)}/runtime`,
    ),

  getValidation: (companyId: string, agentId: string) =>
    api.get<ValidationItem[]>(
      `/companies/${encodeURIComponent(companyId)}/agents/${encodeURIComponent(agentId)}/validation`,
    ),

  getConfigDiff: (companyId: string, agentId: string, revisionId?: string) => {
    const params = new URLSearchParams();
    if (revisionId) params.set("revisionId", revisionId);
    const qs = params.toString();
    return api.get<ConfigDiffResult>(
      `/companies/${encodeURIComponent(companyId)}/agents/${encodeURIComponent(agentId)}/config-diff${qs ? `?${qs}` : ""}`,
    );
  },
};
