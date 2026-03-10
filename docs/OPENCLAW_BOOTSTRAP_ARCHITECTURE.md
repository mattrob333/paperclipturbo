# OpenClaw-First Bootstrap: Architecture & Execution Plan

## Implementation Status

### Wave 1: Foundation ✅
- [x] `provisioning_jobs` DB table with migration (`packages/db/src/schema/provisioning_jobs.ts`, `packages/db/src/migrations/0028_provisioning_jobs.sql`)
- [x] Shared types: ProvisioningJob, ProvisioningPhase, CompanyLifecycleStatus, InstanceReadiness (`packages/shared/src/types/provisioning.ts`)
- [x] Shared validators: startProvisioningSchema, retryProvisioningSchema (`packages/shared/src/validators/provisioning.ts`)
- [x] OpenClaw baseline template (6 files per role + config) (`server/src/openclaw-baseline/`)
- [x] Workspace initializer service (`server/src/services/workspace-initializer.ts`)

### Wave 2: Services ✅
- [x] Provisioning orchestration service (6-phase pipeline) (`server/src/services/provisioning.ts`)
- [x] Instance readiness service (4 health checks) (`server/src/services/instance-readiness.ts`)
- [x] Generation worker service (Claude API integration) (`server/src/services/generation-worker.ts`)

### Wave 3: Routes + Frontend ✅
- [x] Provisioning API routes (5 endpoints) (`server/src/routes/provisioning.ts`)
- [x] Provisioning API client (`ui/src/api/provisioning.ts`)
- [x] BootstrapWizard page (3-step simplified flow) (`ui/src/pages/BootstrapWizard.tsx`)
- [x] ProvisioningProgress page (live phase tracking) (`ui/src/pages/ProvisioningProgress.tsx`)
- [x] Lifecycle-aware navigation (CompanySwitcher, CompanyContext, Dashboard banners)
- [x] Extended CompanyStatus to include draft/provisioning/failed

### Wave 4: Testing ✅
- [x] Provisioning tests (types, validators, services) (`server/src/__tests__/provisioning.test.ts`)
- [x] Full regression verification (17 new tests, all passing)

### Files Created/Modified

**Database (`packages/db/`)**
- `src/schema/provisioning_jobs.ts` — Drizzle schema for provisioning_jobs table
- `src/migrations/0028_provisioning_jobs.sql` — SQL migration

**Shared Types & Validators (`packages/shared/src/`)**
- `types/provisioning.ts` — ProvisioningPhase, ProvisioningJobStatus, CompanyLifecycleStatus, ProvisioningJob, ProvisioningConfig, ReadinessCheck, InstanceReadiness, phase labels/descriptions
- `validators/provisioning.ts` — startProvisioningSchema, retryProvisioningSchema
- `types/index.ts` — re-exports provisioning types and constants
- `validators/index.ts` — re-exports provisioning validators
- `index.ts` — root barrel re-exports

**Server Services (`server/src/services/`)**
- `workspace-initializer.ts` — Baseline template copy with variable substitution
- `instance-readiness.ts` — 4 health checks (workspace root, baseline template, Anthropic key, gateway health)
- `provisioning.ts` — 6-phase orchestration (infra_check, workspace_init, runtime_attach, workspace_verify, generation, activation)
- `generation-worker.ts` — Claude API integration for SOUL.md/IDENTITY.md generation
- `index.ts` — updated with new service exports

**Server Routes (`server/src/routes/`)**
- `provisioning.ts` — GET /readiness, POST /start, GET /:jobId, GET /company/:companyId, POST /:jobId/retry

**OpenClaw Baseline Template (`server/src/openclaw-baseline/`)**
- `README.md` — Template documentation
- `openclaw-agents-config.json` — Agent configuration template
- `executive_assistant/SOUL.md` — Role operating instructions
- `executive_assistant/AGENTS.md` — Agent collaboration instructions
- `executive_assistant/IDENTITY.md` — Agent identity document
- `executive_assistant/TOOLS.md` — Tool policies
- `executive_assistant/MEMORY.md` — Memory and context management
- `executive_assistant/HEARTBEAT.md` — Heartbeat/scheduling instructions

**Frontend (`ui/src/`)**
- `api/provisioning.ts` — Provisioning API client (readiness, start, status, retry)
- `pages/BootstrapWizard.tsx` — 3-step company creation wizard
- `pages/ProvisioningProgress.tsx` — Live phase tracking with log viewer
- `components/CompanySwitcher.tsx` — Lifecycle-aware company switcher
- `context/CompanyContext.tsx` — Company lifecycle context provider

**Tests (`server/src/__tests__/`)**
- `provisioning.test.ts` — 17 tests covering types, validators, workspace initializer, instance readiness

---

## Current State Summary

### Reusable Building Blocks (zero/low modification)
- `compilerBridgeService` - Python IPC for compile/provision/validate
- `instanceService` - Manifest binding, workspace validation, import to Paperclip
- `workspaceService` - File tree operations with path traversal protection
- `buildOrchestratorService` - Build packet assembly, status tracking
- `build_runs` table - Job tracking with status/stage/progress/log
- `agents` table - Already supports `adapterType="openclaw"` + JSONB config
- `instance.ts` shared types - InstanceManifest, OpenClawInstanceConfig, SyncState
- Docker + Dockerfile - Multi-stage production build
- CLI framework - Config management, env parsing, doctor checks

### What Changes
- Company creation bypasses multi-adapter wizard
- Provisioning becomes a tracked, phased pipeline
- OpenClaw is the only runtime path in the main flow
- Companies must pass through provisioning before becoming "active"
- Navigation/routing honors lifecycle state throughout

---

## Data Model Changes

### New Table: `provisioning_jobs`

| Column | Type | Description |
|--------|------|-------------|
| id | uuid PK | Job identifier |
| companyId | uuid FK→companies | Target company |
| status | text | queued, running, completed, failed |
| currentPhase | text | Current provisioning phase |
| phaseProgress | integer | 0-100 within current phase |
| errorMessage | text | Last error |
| errorPhase | text | Phase where error occurred |
| log | jsonb[] | Timestamped log entries |
| workspacePath | text | Resolved workspace path |
| gatewayUrl | text | OpenClaw gateway URL |
| retryCount | integer | Number of retry attempts |
| startedAt | timestamp | When job started |
| completedAt | timestamp | When job completed/failed |
| createdAt | timestamp | Record creation |
| updatedAt | timestamp | Last update |

### Extended: `companies.status`

Add to existing values (`active`, `paused`, `archived`):
- `draft` - Created but not yet provisioned
- `provisioning` - Provisioning pipeline in progress
- `failed` - Provisioning failed (retryable)

Existing companies keep their current status (backward compatible).

---

## Provisioning Pipeline (6 Phases)

```
Phase 1: infra_check
  ├── Verify workspace root directory exists
  ├── Verify OpenClaw baseline template exists
  └── Verify Anthropic API key is configured

Phase 2: workspace_init
  ├── Create company workspace directory from baseline template
  ├── Substitute company name/slug into template files
  └── Write initial openclaw-agents-config.json

Phase 3: runtime_attach
  ├── Verify OpenClaw gateway URL is reachable
  ├── Health check the gateway endpoint
  └── Record gateway URL in provisioning job

Phase 4: workspace_verify
  ├── Verify workspace path is readable from server
  ├── Verify expected file structure exists
  └── Validate workspace against OpenClaw contract

Phase 5: generation
  ├── Invoke Claude-based generation worker
  ├── Generate role folders, SOUL.md, AGENTS.md per role
  ├── Generate company instructions and operating context
  └── Report progress incrementally

Phase 6: activation
  ├── Create/update agents in Paperclip from workspace manifest
  ├── Apply workspace bindings via instanceService
  ├── Set company status to "active"
  └── Mark provisioning job as "completed"
```

---

## Service Architecture

### provisioningService(db)
- `createJob(companyId, config)` → ProvisioningJob
- `executeJob(jobId)` → runs all phases sequentially
- `advancePhase(jobId, phase, progress, logEntry)` → updates tracking
- `failJob(jobId, phase, error)` → marks failed with context
- `retryJob(jobId)` → resets to failed phase, re-executes
- `getJob(jobId)` → full job state
- `getActiveJobForCompany(companyId)` → latest job

### instanceReadinessService()
- `checkWorkspaceRoot()` → { ok, path, error? }
- `checkAnthropicKey()` → { ok, error? }
- `checkOpenClawTemplate()` → { ok, path, error? }
- `checkGatewayHealth(url)` → { ok, status, error? }
- `getFullReadiness()` → aggregate with overall status

### generationWorkerService()
- `generateContent(params)` → { files[], progress[] }
- Params: companyName, description, workspacePath, anthropicKey
- Writes files directly into provisioned workspace
- Reports progress via callback for real-time UI updates

---

## API Routes

### Provisioning
- `POST /api/provisioning/start` → Start provisioning for company
- `GET /api/provisioning/:jobId` → Get job status + logs
- `POST /api/provisioning/:jobId/retry` → Retry from failed phase
- `GET /api/provisioning/company/:companyId` → Latest job for company

### Instance Readiness
- `GET /api/instance/readiness` → Full system readiness check

---

## Frontend Changes

### New: Simplified Company Creation
- Company name + description (no adapter selection)
- Auto-detects system readiness before allowing creation
- Immediately starts provisioning pipeline on submit

### New: Provisioning Progress Screen
- Phase-by-phase progress with live status
- Log viewer for each phase
- Error display with retry button
- Auto-transitions to dashboard on completion

### Modified: Lifecycle-Aware Navigation
- Sidebar: provisioning companies show spinner + muted style
- Dashboard redirect: non-active companies go to provisioning status
- Settings: show provisioning info for non-active companies
- Company switcher: separate provisioning and active companies visually

---

## Execution Waves

### Wave 1: Foundation (parallel)
A. DB schema: provisioning_jobs table + companies status extension + migration
B. Shared types: lifecycle enums, provisioning job types, readiness types, validators
C. OpenClaw baseline template: directory structure + template files

### Wave 2: Services (parallel, after Wave 1)
D. Provisioning orchestration service (phases 1-4, 6)
E. Instance readiness service
F. Generation worker service (phase 5)

### Wave 3: Routes + Frontend (parallel, after Wave 2)
G. Provisioning + readiness API routes
H. Simplified onboarding wizard + provisioning progress UI
I. Lifecycle-aware navigation updates

### Wave 4: Hardening (after Wave 3) ✅
J. Tests + cold-start validation
