import type {
  InstanceReadiness,
  ProvisioningJob,
  StartProvisioningInput,
} from "@paperclipai/shared";
import { api } from "./client";

export const provisioningApi = {
  /** Get system readiness status */
  getReadiness: () =>
    api.get<InstanceReadiness>("/provisioning/readiness"),

  /** Start provisioning a new company */
  start: (data: StartProvisioningInput) =>
    api.post<{ company: { id: string; name: string; issuePrefix: string }; job: ProvisioningJob }>(
      "/provisioning/start",
      data,
    ),

  /** Get provisioning job status */
  getJob: (jobId: string) =>
    api.get<ProvisioningJob>(`/provisioning/${jobId}`),

  /** Get latest job for a company */
  getJobForCompany: (companyId: string) =>
    api.get<ProvisioningJob>(`/provisioning/company/${companyId}`),

  /** Retry a failed job */
  retryJob: (jobId: string) =>
    api.post<ProvisioningJob>(`/provisioning/${jobId}/retry`, {}),
};
