import { Router } from "express";
import type { Db } from "@paperclipai/db";
import {
  createOnboardingProgramSchema,
  updateOnboardingProgramSchema,
  createSponsorIntakeSchema,
  updateSponsorIntakeSchema,
  createParticipantSchema,
  updateParticipantSchema,
  submitDiscoveryResponseSchema,
  runSynthesisSchema,
  generateProposalSchema,
  updateProposalStatusSchema,
} from "@paperclipai/shared";
import { validate } from "../middleware/validate.js";
import {
  onboardingProgramService,
  sponsorIntakeService,
  participantService,
  discoveryService,
  synthesisService,
  proposalService,
} from "../services/index.js";
import { assertBoard } from "./authz.js";
import { DEFAULT_DISCOVERY_QUESTIONS } from "../seed/discovery-questions.js";

function param(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export function onboardingRoutes(db: Db) {
  const router = Router();
  const programSvc = onboardingProgramService(db);
  const intakeSvc = sponsorIntakeService(db);
  const participantSvc = participantService(db);
  const discoverySvc = discoveryService(db);
  const synthesisSvc = synthesisService(db);
  const proposalSvc = proposalService(db);

  // === Program lifecycle ===

  // POST /api/onboarding/programs
  router.post("/programs", validate(createOnboardingProgramSchema), async (req, res) => {
    assertBoard(req);
    const program = await programSvc.createProgram(req.body.companyId, req.body.title);
    // Auto-seed discovery questions for the new program
    await discoverySvc.seedQuestions(program.id, DEFAULT_DISCOVERY_QUESTIONS);
    res.status(201).json(program);
  });

  // GET /api/onboarding/programs/:id
  router.get("/programs/:id", async (req, res) => {
    assertBoard(req);
    const program = await programSvc.getProgram(param(req.params.id));
    res.json(program);
  });

  // GET /api/onboarding/programs/:id/detail
  router.get("/programs/:id/detail", async (req, res) => {
    assertBoard(req);
    const detail = await programSvc.getProgramDetail(param(req.params.id));
    res.json(detail);
  });

  // GET /api/onboarding/programs/:id/progress
  router.get("/programs/:id/progress", async (req, res) => {
    assertBoard(req);
    const progress = await programSvc.getProgramProgress(param(req.params.id));
    res.json(progress);
  });

  // GET /api/onboarding/companies/:companyId/programs
  router.get("/companies/:companyId/programs", async (req, res) => {
    assertBoard(req);
    const programs = await programSvc.listByCompany(param(req.params.companyId));
    res.json(programs);
  });

  // PATCH /api/onboarding/programs/:id
  router.patch("/programs/:id", validate(updateOnboardingProgramSchema), async (req, res) => {
    assertBoard(req);
    const program = await programSvc.updateProgram(param(req.params.id), req.body);
    res.json(program);
  });

  // === Sponsor intake ===

  // POST /api/onboarding/programs/:programId/sponsor-intake
  router.post("/programs/:programId/sponsor-intake", validate(createSponsorIntakeSchema), async (req, res) => {
    assertBoard(req);
    const intake = await intakeSvc.createIntake(param(req.params.programId), req.body);
    res.status(201).json(intake);
  });

  // GET /api/onboarding/programs/:programId/sponsor-intake
  router.get("/programs/:programId/sponsor-intake", async (req, res) => {
    assertBoard(req);
    const intake = await intakeSvc.getIntake(param(req.params.programId));
    res.json(intake);
  });

  // PATCH /api/onboarding/programs/:programId/sponsor-intake
  router.patch("/programs/:programId/sponsor-intake", validate(updateSponsorIntakeSchema), async (req, res) => {
    assertBoard(req);
    const intake = await intakeSvc.updateIntake(param(req.params.programId), req.body);
    res.json(intake);
  });

  // POST /api/onboarding/programs/:programId/sponsor-intake/complete
  router.post("/programs/:programId/sponsor-intake/complete", async (req, res) => {
    assertBoard(req);
    const intake = await intakeSvc.completeIntake(param(req.params.programId));
    res.json(intake);
  });

  // === Participants ===

  // POST /api/onboarding/programs/:programId/participants
  router.post("/programs/:programId/participants", validate(createParticipantSchema), async (req, res) => {
    assertBoard(req);
    const participant = await participantSvc.addParticipant(param(req.params.programId), req.body);
    res.status(201).json(participant);
  });

  // GET /api/onboarding/programs/:programId/participants
  router.get("/programs/:programId/participants", async (req, res) => {
    assertBoard(req);
    const participants = await participantSvc.listParticipants(param(req.params.programId));
    res.json(participants);
  });

  // PATCH /api/onboarding/programs/:programId/participants/:participantId
  router.patch("/programs/:programId/participants/:participantId", validate(updateParticipantSchema), async (req, res) => {
    assertBoard(req);
    const participant = await participantSvc.updateParticipant(
      param(req.params.programId),
      param(req.params.participantId),
      req.body,
    );
    res.json(participant);
  });

  // DELETE /api/onboarding/programs/:programId/participants/:participantId
  router.delete("/programs/:programId/participants/:participantId", async (req, res) => {
    assertBoard(req);
    await participantSvc.removeParticipant(param(req.params.programId), param(req.params.participantId));
    res.status(204).end();
  });

  // === Discovery ===

  // GET /api/onboarding/programs/:programId/discovery/questions
  router.get("/programs/:programId/discovery/questions", async (req, res) => {
    assertBoard(req);
    const questions = await discoverySvc.getQuestions(param(req.params.programId));
    res.json(questions);
  });

  // POST /api/onboarding/programs/:programId/discovery/responses
  router.post("/programs/:programId/discovery/responses", validate(submitDiscoveryResponseSchema), async (req, res) => {
    assertBoard(req);
    const response = await discoverySvc.submitResponse(req.body);
    res.status(201).json(response);
  });

  // GET /api/onboarding/programs/:programId/discovery/responses/:participantId
  router.get("/programs/:programId/discovery/responses/:participantId", async (req, res) => {
    assertBoard(req);
    const responses = await discoverySvc.getResponses(
      param(req.params.programId),
      param(req.params.participantId),
    );
    res.json(responses);
  });

  // GET /api/onboarding/programs/:programId/discovery/progress/:participantId
  router.get("/programs/:programId/discovery/progress/:participantId", async (req, res) => {
    assertBoard(req);
    const progress = await discoverySvc.getParticipantProgress(
      param(req.params.programId),
      param(req.params.participantId),
    );
    res.json(progress);
  });

  // POST /api/onboarding/programs/:programId/discovery/complete
  router.post("/programs/:programId/discovery/complete", async (req, res) => {
    assertBoard(req);
    const { participantId } = req.body;
    const result = await discoverySvc.completeDiscovery(
      param(req.params.programId),
      participantId,
    );
    res.json(result);
  });

  // === Synthesis ===

  // POST /api/onboarding/programs/:programId/synthesis/run
  router.post("/programs/:programId/synthesis/run", validate(runSynthesisSchema), async (req, res) => {
    assertBoard(req);
    const artifacts = await synthesisSvc.runSynthesis(param(req.params.programId), req.body.artifactTypes);
    res.status(201).json(artifacts);
  });

  // GET /api/onboarding/programs/:programId/synthesis
  router.get("/programs/:programId/synthesis", async (req, res) => {
    assertBoard(req);
    const artifacts = await synthesisSvc.listArtifacts(param(req.params.programId));
    res.json(artifacts);
  });

  // GET /api/onboarding/programs/:programId/synthesis/:artifactId
  router.get("/programs/:programId/synthesis/:artifactId", async (req, res) => {
    assertBoard(req);
    const artifact = await synthesisSvc.getArtifact(
      param(req.params.programId),
      param(req.params.artifactId),
    );
    res.json(artifact);
  });

  // DELETE /api/onboarding/programs/:programId/synthesis
  router.delete("/programs/:programId/synthesis", async (req, res) => {
    assertBoard(req);
    await synthesisSvc.clearArtifacts(param(req.params.programId));
    res.status(204).end();
  });

  // === Proposals ===

  // POST /api/onboarding/programs/:programId/proposal/generate
  router.post("/programs/:programId/proposal/generate", validate(generateProposalSchema), async (req, res) => {
    assertBoard(req);
    const proposal = await proposalSvc.generateProposal(param(req.params.programId));
    res.status(201).json(proposal);
  });

  // GET /api/onboarding/programs/:programId/proposal
  router.get("/programs/:programId/proposal", async (req, res) => {
    assertBoard(req);
    const proposal = await proposalSvc.getProposal(param(req.params.programId));
    res.json(proposal);
  });

  // GET /api/onboarding/programs/:programId/proposal/history
  router.get("/programs/:programId/proposal/history", async (req, res) => {
    assertBoard(req);
    const proposals = await proposalSvc.getProposalHistory(param(req.params.programId));
    res.json(proposals);
  });

  // PATCH /api/onboarding/programs/:programId/proposal/:proposalId
  router.patch("/programs/:programId/proposal/:proposalId", validate(updateProposalStatusSchema), async (req, res) => {
    assertBoard(req);
    const proposal = await proposalSvc.updateProposalStatus(
      param(req.params.programId),
      param(req.params.proposalId),
      req.body.status,
      req.body.revisionNotes,
    );
    res.json(proposal);
  });

  return router;
}
