import { api } from "./client";
import type {
  ExperienceStateInfo,
  BuildRun,
  BuildPacket,
  GeneratedFileNode,
} from "@paperclipai/shared";

export const experienceApi = {
  getState: (companyId: string) =>
    api.get<ExperienceStateInfo>(`/experience/state/${companyId}`),

  startBuild: (programId: string, force?: boolean) =>
    api.post<BuildRun>(`/experience/build/${programId}`, { force }),

  getBuildRun: (programId: string) =>
    api.get<BuildRun>(`/experience/build/${programId}`),

  getBuildPacket: (programId: string) =>
    api.get<BuildPacket>(`/experience/build/${programId}/packet`),

  getGeneratedFiles: (programId: string) =>
    api.get<GeneratedFileNode>(`/experience/build/${programId}/files`),

  seedDemo: () =>
    api.post<{ success: boolean; companyId: string; message?: string }>(
      "/experience/seed-demo",
      {},
    ),
};
