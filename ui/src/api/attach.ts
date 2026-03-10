import type { DiscoveryResult, AttachResult } from "@paperclipai/shared";
import { api } from "./client";

export const attachApi = {
  /** Discover agents and validate an existing OpenClaw workspace */
  discover: (gatewayUrl: string, workspacePath: string) =>
    api.post<DiscoveryResult>("/attach/discover", { gatewayUrl, workspacePath }),

  /** Confirm attach and create the company + agents */
  confirm: (data: {
    gatewayUrl: string;
    workspacePath: string;
    companyName: string;
    companyDescription?: string;
    selectedAgentFolders?: string[];
  }) => api.post<AttachResult>("/attach/confirm", data),
};
