import type {
  InstanceManifest,
  InstanceSummary,
  ConnectionValidation,
  ProvisionResult,
  SyncState,
} from "@paperclipai/shared";
import { api } from "./client";

export const instancesApi = {
  list: () => api.get<InstanceSummary[]>("/instances"),
  get: (companySlug: string) =>
    api.get<InstanceManifest>(`/instances/${encodeURIComponent(companySlug)}`),
  blueprint: (companySlug: string) =>
    api.get<{ yaml: string }>(`/instances/${encodeURIComponent(companySlug)}/blueprint`),
  validate: (companySlug: string) =>
    api.post<ConnectionValidation>(
      `/instances/${encodeURIComponent(companySlug)}/validate`,
      {},
    ),
  import: (companySlug: string) =>
    api.post<ProvisionResult>(
      `/instances/${encodeURIComponent(companySlug)}/import`,
      {},
    ),
  syncStatus: (companySlug: string) =>
    api.get<SyncState>(`/instances/${encodeURIComponent(companySlug)}/sync`),
  sync: (companySlug: string) =>
    api.post<SyncState>(
      `/instances/${encodeURIComponent(companySlug)}/sync`,
      {},
    ),
};
