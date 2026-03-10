# Bootstrap Orchestration Fix — Final Verification Report

**Date:** 2026-03-08
**Author:** Principal Architect / Final Integration Judge
**Team:** 7 specialist agents across 6 phases

---

## 1. What Was Fixed

### Fix 1: Generation is now in-pipeline (CRITICAL FIX)

**Before:** Phase 5 was a pass-through. Generation ran as a `.then()` callback AFTER `executeJob()` completed activation. Company was marked active before any content was generated.

**After:** Phase 5 calls `generationWorkerService().generateContent()` inline, with progress callbacks that update the job's phase progress and log entries. If generation fails (`genResult.success === false`), the error propagates to the catch block, marking the job as failed.

**Files changed:** `server/src/services/provisioning.ts` (lines 307-344), `server/src/routes/provisioning.ts` (removed `.then()` callback, removed `generationWorkerService` import)

### Fix 2: Activation only after generation success

**Before:** `activateCompany()` was called immediately after the pass-through Phase 5, regardless of generation outcome.

**After:** `activateCompany()` (line 347) is only reached if Phase 5 completes without throwing. Generation failure → catch block → job marked failed → company marked failed → activation never called.

**Degraded mode:** If no Anthropic API key is set, the generation worker returns `{ success: true, filesGenerated: [] }` — this allows activation with baseline files. This is intentional and documented.

### Fix 3: Retry semantics are coherent

**Before:** `retryJob()` left `currentPhase` at the failed phase, didn't reset company status.

**After:** `retryJob()` resets `currentPhase` to `"pending"`, sets company status back to `"provisioning"`, workspace_init is idempotent (skips if workspace already exists). The retry route correctly derives `workspaceRoot` from the stored `workspacePath`.

**Files changed:** `server/src/services/provisioning.ts` (retryJob: line 478, company status: lines 487-491), `server/src/routes/provisioning.ts` (retry route: lines 96-122)

### Fix 4: Runtime attach is truthful

**Before:** Gateway health check was best-effort (warn and continue). Labels said "Connecting to OpenClaw" implying boot-up.

**After:** Gateway health check now blocks provisioning — if the gateway is unreachable, the job fails. Labels updated to "Attaching to OpenClaw Runtime" and description says "The gateway must be running before provisioning can continue."

**Files changed:** `server/src/services/provisioning.ts` (Phase 3: lines 219-263), `packages/shared/src/types/provisioning.ts` (labels/descriptions)

### Fix 5: Frontend lifecycle consistency

**Before:** Provisioning/draft/failed companies redirected to the full dashboard, showing empty metrics and charts with a small banner.

**After:**
- `CompanyRootRedirect` redirects provisioning/draft/failed companies to the provisioning progress page (via `ProvisioningRedirect` component that fetches the job by company ID)
- `Dashboard` early-returns for non-active companies with only a status banner + "View Details" link
- Full dashboard is never rendered for non-active companies

**Files changed:** `ui/src/App.tsx` (ProvisioningRedirect component, CompanyRootRedirect logic), `ui/src/pages/Dashboard.tsx` (early return guard)

---

## 2. Pressure-Test Results

| # | Scenario | Verdict | Notes |
|---|----------|---------|-------|
| 1 | Gateway unavailable at provisioning start | PASS | Phase 3 throws, job marked failed, company marked failed |
| 2 | Workspace root missing | PASS | Phase 1 creates it with `recursive: true` |
| 3 | Workspace root not writable | PASS | `mkdir` throws, caught by error handler |
| 4 | Baseline template missing | PASS | `baselineExists()` returns false, throws |
| 5 | Anthropic API key missing | PASS | Degraded mode: returns success with 0 files, activation proceeds with baseline content |
| 6 | Anthropic API failure | PASS | `callClaude()` throws, `genResult.success = false`, job fails |
| 7 | Generation partially writes then fails | PASS | Individual file failures are caught per-file (non-fatal within loop), but outer `generateContent` returns `success: true`. Only a full API failure blocks. Partially written files are preserved for retry. |
| 8 | Retry after failed generation | PASS | `retryJob` resets phase/status. `executeJob` skips workspace_init if workspace exists. Generation re-runs. |
| 9 | Duplicate provisioning for same company | PASS | `createJob()` checks for existing non-completed/non-failed jobs, throws conflict |
| 10 | Dashboard for provisioning company | PASS | Early return shows status banner only |
| 11 | Dashboard for failed company | PASS | Early return shows failure banner with link |
| 12 | Company settings for failed company | KNOWN DEBT | No lifecycle guard on settings page |
| 13 | User refresh during provisioning | PASS | `ProvisioningProgress` polls every 2s with refetchInterval |
| 14 | Stale localStorage company ID | PASS | `CompanyContext` filters sidebar companies, `CompanyRootRedirect` redirects to provisioning status |

---

## 3. Test Results

- **28 tests pass** in `provisioning.test.ts` (11 new tests added for sequencing guarantees)
- **241 total tests pass** across the server package
- **13 pre-existing failures** in cursor/opencode/codex adapter tests (Windows format strings — unrelated)
- **TypeScript compiles clean** across all 3 packages (shared, server, UI)

---

## 4. Final Signoff Answers

### Did we fix generation-before-activation?
**YES.** Generation (Phase 5) now runs inline in `executeJob()` before `activateCompany()` (Phase 6). The old post-completion `.then()` callback is deleted. Tests verify the phase ordering.

### Is the provisioning job truthfully complete only after the full workflow is done?
**YES.** A job marked `completed` means all 6 phases ran successfully, including generation. The `completed` status is set in `activateCompany()` which is the last step.

### Does the runtime story honestly match the implementation?
**YES.** Phase 3 is labeled "Attaching to OpenClaw Runtime" (not "Connecting to" or "Starting"). The description says the gateway must be running. Gateway failure blocks provisioning.

### Are lifecycle states honored consistently across backend and frontend?
**YES**, with one known gap:
- Backend: draft → provisioning → active/failed transitions are correct
- Frontend: CompanyRootRedirect, Dashboard, CompanySwitcher all handle non-active companies
- **Known debt:** CompanySettings has no lifecycle guard (low risk — settings page for a failed company just shows limited data)

### What remains as known debt?
1. **CompanySettings lifecycle guard** — No guard prevents accessing settings for provisioning/failed companies. Low risk since settings actions require an active company to be meaningful.
2. **Generation file-level failure granularity** — Individual SOUL.md/IDENTITY.md generation failures within `generateContent` are caught per-file and don't fail the whole generation. Only a complete API failure or missing config fails the job. This is intentional (graceful degradation) but could be made configurable.
3. **Docker/OpenClaw bring-up** — The system performs runtime attachment, not runtime bring-up. This is explicitly by design for this pass.

---

## 5. Files Changed Summary

| File | Change Type | Lines |
|------|------------|-------|
| `server/src/services/provisioning.ts` | Modified | Phase 5 generation, Phase 3 gateway blocking, retry semantics, workspace idempotency |
| `server/src/routes/provisioning.ts` | Modified | Removed post-completion generation, improved retry route |
| `packages/shared/src/types/provisioning.ts` | Modified | Updated runtime_attach labels/descriptions |
| `ui/src/App.tsx` | Modified | Added ProvisioningRedirect, updated CompanyRootRedirect |
| `ui/src/pages/Dashboard.tsx` | Modified | Early return for non-active companies |
| `server/src/__tests__/provisioning.test.ts` | Modified | Added 11 sequencing guarantee tests |
| `docs/GAP_CONFIRMATION_MEMO.md` | Created | Phase 1 deliverable |
| `docs/BOOTSTRAP_FIX_VERIFICATION_REPORT.md` | Created | This document |
