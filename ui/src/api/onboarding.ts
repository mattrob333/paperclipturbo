import type {
  OnboardingProgram,
  OnboardingProgramSummary,
  OnboardingProgramDetail,
  OnboardingProgramProgress,
  SponsorIntake,
  OnboardingParticipant,
  DiscoveryQuestion,
  DiscoveryResponse,
  CreateOnboardingProgram,
  CreateSponsorIntake,
  UpdateSponsorIntake,
  CreateParticipant,
  UpdateParticipant,
  SubmitDiscoveryResponse,
  SynthesisArtifact,
  SynthesisArtifactType,
  OnboardingProposal,
  UpdateProposalStatus,
} from "@paperclipai/shared";
import { api } from "./client";

export const onboardingApi = {
  // Programs
  createProgram: (data: CreateOnboardingProgram) =>
    api.post<OnboardingProgram>("/onboarding/programs", data),
  getProgram: (id: string) =>
    api.get<OnboardingProgram>(`/onboarding/programs/${id}`),
  getProgramDetail: (id: string) =>
    api.get<OnboardingProgramDetail>(`/onboarding/programs/${id}/detail`),
  listPrograms: (companyId: string) =>
    api.get<OnboardingProgramSummary[]>(`/onboarding/companies/${companyId}/programs`),
  updateProgram: (id: string, data: Record<string, unknown>) =>
    api.patch<OnboardingProgram>(`/onboarding/programs/${id}`, data),

  // Sponsor intake
  createIntake: (programId: string, data: CreateSponsorIntake) =>
    api.post<SponsorIntake>(`/onboarding/programs/${programId}/sponsor-intake`, data),
  getIntake: (programId: string) =>
    api.get<SponsorIntake>(`/onboarding/programs/${programId}/sponsor-intake`),
  updateIntake: (programId: string, data: UpdateSponsorIntake) =>
    api.patch<SponsorIntake>(`/onboarding/programs/${programId}/sponsor-intake`, data),
  completeIntake: (programId: string) =>
    api.post<SponsorIntake>(`/onboarding/programs/${programId}/sponsor-intake/complete`, {}),

  // Participants
  addParticipant: (programId: string, data: CreateParticipant) =>
    api.post<OnboardingParticipant>(`/onboarding/programs/${programId}/participants`, data),
  listParticipants: (programId: string) =>
    api.get<OnboardingParticipant[]>(`/onboarding/programs/${programId}/participants`),
  updateParticipant: (programId: string, participantId: string, data: UpdateParticipant) =>
    api.patch<OnboardingParticipant>(`/onboarding/programs/${programId}/participants/${participantId}`, data),
  removeParticipant: (programId: string, participantId: string) =>
    api.delete<void>(`/onboarding/programs/${programId}/participants/${participantId}`),

  // Discovery
  getQuestions: (programId: string) =>
    api.get<DiscoveryQuestion[]>(`/onboarding/programs/${programId}/discovery/questions`),
  submitResponse: (programId: string, data: SubmitDiscoveryResponse) =>
    api.post<DiscoveryResponse>(`/onboarding/programs/${programId}/discovery/responses`, data),
  getResponses: (programId: string, participantId: string) =>
    api.get<DiscoveryResponse[]>(`/onboarding/programs/${programId}/discovery/responses/${participantId}`),
  getDiscoveryProgress: (programId: string, participantId: string) =>
    api.get<{ totalQuestions: number; answeredQuestions: number; isComplete: boolean }>(
      `/onboarding/programs/${programId}/discovery/progress/${participantId}`
    ),
  completeDiscovery: (programId: string, participantId: string) =>
    api.post<{ completed: boolean }>(`/onboarding/programs/${programId}/discovery/complete`, { participantId }),

  // Program progress
  getProgramProgress: (id: string) =>
    api.get<OnboardingProgramProgress>(`/onboarding/programs/${id}/progress`),

  // Synthesis
  runSynthesis: (programId: string, opts?: { artifactTypes?: SynthesisArtifactType[] }) =>
    api.post<SynthesisArtifact[]>(`/onboarding/programs/${programId}/synthesis/run`, opts ?? {}),
  listSynthesisArtifacts: (programId: string) =>
    api.get<SynthesisArtifact[]>(`/onboarding/programs/${programId}/synthesis`),
  getSynthesisArtifact: (programId: string, artifactId: string) =>
    api.get<SynthesisArtifact>(`/onboarding/programs/${programId}/synthesis/${artifactId}`),
  clearSynthesis: (programId: string) =>
    api.delete<void>(`/onboarding/programs/${programId}/synthesis`),

  // Proposals
  generateProposal: (programId: string) =>
    api.post<OnboardingProposal>(`/onboarding/programs/${programId}/proposal/generate`, {}),
  getProposal: (programId: string) =>
    api.get<OnboardingProposal>(`/onboarding/programs/${programId}/proposal`),
  getProposalHistory: (programId: string) =>
    api.get<OnboardingProposal[]>(`/onboarding/programs/${programId}/proposal/history`),
  updateProposalStatus: (programId: string, proposalId: string, data: UpdateProposalStatus) =>
    api.patch<OnboardingProposal>(`/onboarding/programs/${programId}/proposal/${proposalId}`, data),
};
