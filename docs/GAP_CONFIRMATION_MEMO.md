# Gap Confirmation Memo — OpenClaw Bootstrap Orchestration Fix

**Date:** 2026-03-08
**Author:** Principal Architect / Program Orchestrator (Phase 1)
**Status:** Gap analysis complete. Implementation authorized to proceed.

---

## 1. What the Previous Implementation Completed

The prior 4-wave implementation delivered real, functional building blocks:

| Layer | Artifact | Status |
|-------|----------|--------|
| DB | `provisioning_jobs` table + migration 0028 | Complete, usable |
| DB | Extended `companies.status` with draft/provisioning/failed | Complete |
| Shared | `ProvisioningPhase` (7 phases), `ProvisioningJobStatus` (4), `CompanyLifecycleStatus` (6) | Complete |
| Shared | `ProvisioningJob`, `ProvisioningLogEntry`, `ReadinessCheck`, `InstanceReadiness` interfaces | Complete |
| Shared | `startProvisioningSchema`, `retryProvisioningSchema` Zod validators | Complete |
| Shared | Phase labels and descriptions for UI | Complete |
| Server | `provisioningService` — createJob, executeJob (phases 1-4,6), activateCompany, retryJob | Structurally complete, **sequencing wrong** |
| Server | `instanceReadinessService` — 4 health checks, aggregate readiness | Complete |
| Server | `generationWorkerService` — Claude API integration for SOUL.md/IDENTITY.md | Complete but **disconnected from pipeline** |
| Server | `workspaceInitializerService` — baseline template copy with variable substitution | Complete |
| Server | OpenClaw baseline template (8 files, {{VAR}} substitution) | Complete |
| Routes | 5 provisioning endpoints | Complete but **/start has sequencing bug** |
| Frontend | `BootstrapWizard` — 3-step wizard with readiness checks | Complete |
| Frontend | `ProvisioningProgress` — live polling, phase stepper, log viewer | Complete |
| Frontend | `CompanySwitcher` — lifecycle-aware status dots and badges | Partial |
| Frontend | `CompanyContext` — filters draft from sidebar | Partial |
| Frontend | `Dashboard` — provisioning/failed banners | Partial |
| Frontend | `App.tsx` — /bootstrap, /provisioning/:jobId routes, CompanyRootRedirect | Partial |
| Tests | 17 tests: types, validators, workspace initializer, readiness | Complete but **insufficient** |

**Summary: ~80% of the scaffolding is done. The critical 20% — sequencing, runtime truth, lifecycle hardening, and proof through tests — is missing.**

---

## 2. What Remains Broken

### BUG A: Generation runs AFTER activation (Critical)

**Location:** `server/src/routes/provisioning.ts:46-68` and `server/src/services/provisioning.ts:304-310`

The provisioning route does this:
```
svc.executeJob(...)          // runs phases 1-4, skips 5, runs 6 (activation)
  .then(() => {
    genWorker.generateContent(...)  // generation runs AFTER company is active
  })
```

Inside `executeJob()`, Phase 5 (generation) is a **pass-through**:
```typescript
// === Phase 5: generation (pass-through) ===
await setPhase(jobId, "generation");
await appendLog(jobId, logEntry("info", "generation", "Generation phase ready."));
await setPhase(jobId, "generation", 100);  // immediately 100%

// === Phase 6: activation ===
await this.activateCompany(jobId);  // company becomes active
```

**Impact:** A company is marked `active` and the job is marked `completed` before any Claude-generated content exists. The user sees "Your Company is Ready" while generation hasn't even started.

### BUG B: Runtime bring-up is truthfully just a health check (Medium)

**Location:** `server/src/services/provisioning.ts:210-258` and `server/src/services/instance-readiness.ts`

Phase 3 (`runtime_attach`) performs a **best-effort** gateway health check. If it fails, it logs a warning and continues. No Docker containers are started. No `docker-compose up` is invoked.

The system assumes OpenClaw is already running externally. This is not necessarily wrong, but the code, docs, and UX currently claim "deterministic cold-start" and "Connecting to OpenClaw" which implies the system boots the runtime.

**Decision required:** Either implement true bring-up OR explicitly narrow the promise.

### BUG C: Retry semantics are incoherent (Medium)

**Location:** `server/src/services/provisioning.ts:433-462` and `server/src/routes/provisioning.ts:98-127`

1. `retryJob()` resets `status` to `"queued"` but does **not** reset `currentPhase` — leaving it pointing at the failed phase while `executeJob()` always starts from Phase 1.
2. `retryJob()` does **not** set the company status back from `"failed"` to `"provisioning"`.
3. The retry route re-calls `executeJob()` which re-runs all phases from the beginning, including workspace_init — this will re-copy the baseline template over any partially-generated content.
4. Generation is not part of retry because it's a post-completion side effect.

### BUG D: Frontend lifecycle gaps (Medium)

1. **CompanySwitcher** (`CompanySwitcher.tsx:83-101`): Provisioning companies appear in the dropdown and are selectable, but clicking them navigates to the normal board layout (dashboard/agents/etc.) instead of the provisioning progress page.

2. **CompanyRootRedirect** (`App.tsx:200-207`): Provisioning/draft/failed companies redirect to `/${prefix}/dashboard` — showing a status banner at the top but rendering the full dashboard (agents, issues, costs, activity) below, which is empty and misleading.

3. **Dashboard** (`Dashboard.tsx:195-220`): Shows provisioning/failed banners but still renders the full dashboard grid below them, including queries for agents/issues/projects that will return empty results.

4. **Company Settings**: No guard against accessing settings for provisioning/draft/failed companies. Settings actions (archive, etc.) could create inconsistent state.

5. **No link to provisioning progress**: From the provisioning banner in Dashboard, there's no link to navigate to `/provisioning/:jobId` to see actual progress/logs.

### BUG E: Tests prove nothing about critical guarantees (Low urgency, high importance)

Current 17 tests validate:
- Type constants exist
- Validators accept/reject correct shapes
- Workspace initializer creates files
- Readiness checks return expected structure

They do **not** validate:
- Generation runs before activation
- Activation occurs only after generation success
- Job completion means full pipeline completion
- Retry correctly handles partial state
- Company status transitions are correct
- Lifecycle-aware routing consistency

---

## 3. Fix Ownership Map

| Fix | Owner | Files |
|-----|-------|-------|
| **A: Generation in-pipeline** | Backend Lifecycle + Generation Pipeline Engineers | `provisioning.ts`, `routes/provisioning.ts`, `generation-worker.ts` |
| **B: Runtime truth** | Runtime/Docker Engineer | `provisioning.ts` (phase 3), `instance-readiness.ts`, docs |
| **C: Retry coherence** | Backend Lifecycle Engineer | `provisioning.ts` (retryJob), `routes/provisioning.ts` (retry route) |
| **D: Frontend lifecycle** | Frontend Lifecycle Engineer | `CompanySwitcher.tsx`, `CompanyContext.tsx`, `Dashboard.tsx`, `App.tsx`, `CompanySettings.tsx` |
| **E: Tests** | QA Engineer | `provisioning.test.ts` (extend), potentially new test files |

---

## 4. Minimal Correct Fix Sequence

### Phase 2: Backend Sequencing Correction

**Priority: CRITICAL. Must happen first.**

1. **Integrate generation into `executeJob()`** — Phase 5 must call `genWorker.generateContent()` with progress callbacks that update the job's phase progress and log entries.
2. **Generation failure policy** — Define: Does generation failure block activation? Answer: Yes, with a configurable "allow degraded" flag that defaults to blocking.
3. **Remove post-completion generation from route** — Delete the `.then()` callback in `routes/provisioning.ts:52-65`.
4. **Fix activation guard** — `activateCompany()` should verify generation result before marking the company active.
5. **Fix retry semantics** — `retryJob()` must: (a) reset currentPhase to a deterministic start point, (b) set company status back to "provisioning", (c) handle partial workspace state (skip re-init if workspace exists and is valid).

### Phase 3: Runtime Truth

1. **Explicitly narrow the cold-start promise** — The system performs "runtime attachment," not "runtime bring-up." Rename/re-document accordingly.
2. **Make gateway check meaningful** — If gateway is unreachable, the provisioning job should fail (not warn-and-continue) since agents won't work without it.
3. **Update Phase 3 description** — "Attaching to OpenClaw runtime" instead of "Connecting to OpenClaw."

### Phase 4: Frontend Lifecycle Hardening

1. **Provisioning/failed company click in CompanySwitcher** — Navigate to provisioning progress page, not dashboard.
2. **Dashboard for non-active companies** — Show only the status banner + navigation to provisioning progress. Do not render empty metrics/charts.
3. **CompanyRootRedirect** — Provisioning companies should redirect to provisioning progress, not dashboard.
4. **Add provisioning link in Dashboard banner** — Link to `/provisioning/:jobId`.
5. **Guard CompanySettings** — Show read-only view or redirect for non-active companies.

### Phase 5: Tests

1. Test that `executeJob()` calls generation before activation.
2. Test that job `status === "completed"` implies generation ran.
3. Test retry resets company status and currentPhase correctly.
4. Test that generation failure results in job failure (not completion).

---

## 5. What Can Be Reused Unchanged

- `provisioning_jobs` DB schema and migration — no changes needed
- `ProvisioningPhase`, `ProvisioningJobStatus`, `CompanyLifecycleStatus` types — no changes needed
- Zod validators — no changes needed
- `workspaceInitializerService` — no changes needed
- `instanceReadinessService` — minor change (gateway check strictness)
- `generationWorkerService` — no changes needed (it's a well-structured service, just disconnected)
- `BootstrapWizard` — no changes needed
- `ProvisioningProgress` — no changes needed
- Phase labels/descriptions — minor text update for Phase 3

---

## 6. Review Gates

| Gate | After Phase | Reviewers | Pass Criteria |
|------|-------------|-----------|---------------|
| **Gate 1** | Phase 2 (Backend) | Code Review + Pressure Test | Generation is provably in-pipeline. Activation blocked on generation success. Retry is coherent. |
| **Gate 2** | Phase 3 (Runtime) | Code Review + Pressure Test | Runtime promise matches implementation. Gateway failure blocks provisioning. |
| **Gate 3** | Phase 4 (Frontend) | Code Review + Pressure Test | No misleading UI for non-active companies. Routing is lifecycle-consistent. |
| **Gate 4** | Phase 5 (Tests) | Final Integration Judge | Tests prove generation-before-activation, retry correctness, lifecycle consistency. TypeScript compiles clean. All tests pass. |

---

## 7. Decision Log

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Generation failure blocks activation? | **Yes** (default) | A company without generated content is not "ready." The baseline template files exist as fallback, but activation should require explicit generation success or an intentional skip. |
| Retry starts from which phase? | **From the beginning** but skip workspace_init if workspace already exists | Simpler than phase-level resume. Workspace check is idempotent. |
| Cold-start or runtime attachment? | **Runtime attachment** (narrow the promise) | True Docker orchestration is out of scope for this fix pass. Honest labeling is better than false claims. |
| Gateway failure: warn or block? | **Block** (fail the job) | A company without a reachable gateway cannot function. Best-effort warnings hide real problems. |

---

**Memo complete. Proceeding to Phase 2 implementation.**
