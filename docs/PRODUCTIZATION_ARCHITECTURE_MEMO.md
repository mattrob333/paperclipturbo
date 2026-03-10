# OpenClaw Productization — Phase 1 Architecture Memo

**Date:** 2026-03-09
**Author:** Product Architect / Program Orchestrator (Agent 1)
**Mandate:** CLAUDE_CODE_OPENCLAW_PRODUCTIZATION_MANDATE.md

---

## 1. What the Current Implementation Already Supports

### Provisioning Pipeline (Strong)
- 6-phase sequential pipeline: infra_check → workspace_init → runtime_attach → workspace_verify → generation → activation
- Generation-before-activation invariant enforced (Phase 5 runs inline before Phase 6)
- Provisioning job persistence with structured JSONB logging
- Async execution with 2-second polling from frontend
- Retry semantics: reset to pending, company back to provisioning, workspace init is idempotent
- 45 automated tests covering sequencing, lifecycle, gateway blocking, retry

### Workspace Management (Strong)
- Baseline template system: copies `openclaw-baseline/` directory with `{{VAR}}` substitution
- Template includes: `openclaw-agents-config.json`, `executive_assistant/` with 6 required files (SOUL.md, AGENTS.md, IDENTITY.md, TOOLS.md, MEMORY.md, HEARTBEAT.md)
- Generation worker enhances SOUL.md and IDENTITY.md via Claude API (graceful degradation without API key)
- Workspace verification: checks config file + all agent folders + all required files

### Frontend Lifecycle (Adequate)
- BootstrapWizard: 3-step flow (readiness → company details → confirm)
- ProvisioningProgress: real-time phase stepper with log viewer, retry button
- OnboardingWizard: 4-step flow (company → agent → task → launch) with 7 adapter types
- Dashboard lifecycle guard: non-active companies show status banner only
- CompanyRootRedirect: provisioning/draft/failed companies redirect to progress page
- CompanySwitcher: filters archived/draft, shows status badges

### Readiness Checks (Adequate)
- 4 checks: workspace root writable, baseline template exists, Anthropic API key set, gateway healthy
- Overall status: ready / degraded / not_ready
- Used by BootstrapWizard Step 1

### Multi-Company Support (Basic)
- Multiple companies can exist in the database
- CompanySwitcher allows switching between them
- Each company gets its own workspace subdirectory
- CompanyContext auto-selects first available company
- OnboardingWizard can create additional companies

---

## 2. What is Missing for Attach-Existing-OpenClaw (Mode A)

### No attach flow exists at any layer

| Layer | Current State | Gap |
|-------|--------------|-----|
| **UI** | No mode selector. No "attach existing" option. Only create-new flows (BootstrapWizard, OnboardingWizard). | Need mode chooser + attach wizard |
| **API** | No endpoint accepts an existing workspace/gateway and imports it. `/provisioning/start` always creates a new company from scratch. | Need attach/import endpoints |
| **Service** | No workspace discovery/scanning logic. `validateConnection()` in `instance.ts` validates structure but doesn't scan or discover. | Need discovery service |
| **Parsing** | `openclaw-agents-config.json` parsing exists in workspace_verify phase but only for newly-created workspaces. | Need to parse arbitrary existing configs |
| **Agent creation** | `activateCompany()` creates agents from config, but only as part of the full provisioning pipeline. | Need standalone agent-from-discovery creation |

### What does exist that can be reused

1. **`instance.ts` → `validateConnection()`**: Validates workspace structure (config file, role folders, required files). Can be adapted into a discovery validator.
2. **`workspace_verify` phase logic**: Reads `openclaw-agents-config.json`, enumerates agent folders, checks required files. This IS the discovery contract.
3. **`activateCompany()`**: Creates agent rows from config. Can be extracted and reused for attach mode.
4. **`instance-readiness.ts` → `checkGatewayHealth()`**: Gateway health check. Directly reusable.
5. **AgentOrgCompiler `connect_existing_instance()`**: Python-side instance connection (separate system, not directly callable from Paperclip server).

### Minimum viable attach contract

To attach an existing OpenClaw workspace, the user must provide:

| Field | Required | Source |
|-------|----------|--------|
| Gateway URL | Yes | User provides or discovered from env |
| Workspace path | Yes | User provides filesystem path |
| Company name | Yes | User provides or inferred from config |

Paperclip then:
1. Validates gateway is reachable (health check)
2. Scans workspace path for `openclaw-agents-config.json`
3. Reads agent definitions from config
4. Validates each agent folder has required files
5. Presents discovered agents to user for confirmation
6. Creates company + agent rows with adapter configs pointing to existing workspace
7. Marks company as active (no generation phase needed — files already exist)

---

## 3. What is Missing for Cold-Start Multi-Team Isolation (Mode B)

### Current cold-start model

The current cold-start flow works correctly for a single team:

```
BootstrapWizard → POST /provisioning/start → 6-phase pipeline → company active
```

However, it has no concept of runtime isolation or multi-team boundaries.

### Runtime model implied by code

| Concept | Current Implementation |
|---------|----------------------|
| Gateway URL | Global env var `OPENCLAW_GATEWAY_URL` (default: `host.docker.internal:18789`). Stored per-provisioning-job but not per-company. |
| Runtime binding | Per-agent in `adapterConfig.url`. All agents in a company typically point to same gateway. |
| Company table | No gateway/runtime fields. Company is purely a logical grouping. |
| Workspace isolation | File-based: each company gets `{workspaceRoot}/{companySlug}/` subdirectory. |
| Database isolation | None. All companies share one PostgreSQL instance. |
| Docker management | None. Docker compose files exist for manual setup but no programmatic orchestration. |

### What "multi-team" means today

Creating a second company:
1. OnboardingWizard creates company + agent (uses same global gateway URL)
2. OR BootstrapWizard provisions company (uses same global gateway URL)
3. Workspace files go to `{workspaceRoot}/{company2Slug}/`
4. Agents point to same gateway as company 1
5. No runtime-level isolation

### What is missing

| Gap | Impact | Priority |
|-----|--------|----------|
| No per-company gateway URL field | Companies can't declare which runtime they use | High |
| No runtime registry | No way to track which companies are on which runtimes | High |
| No Docker orchestration | Can't auto-provision isolated runtime containers | Medium (future) |
| No isolation validation | Can't verify teams don't leak into each other's workspaces | Medium |
| No runtime selector in onboarding | User can't choose "use existing runtime" vs "create new runtime" | High |

### Pragmatic approach: shared runtime with explicit choice

Full Docker orchestration (auto-provisioning isolated containers per team) is a large undertaking that should not block productization. The pragmatic path:

1. **Add runtime concept to company model**: Store `gatewayUrl` on the company (not just per-agent)
2. **Add runtime selector to onboarding**: "Which OpenClaw runtime should this team use?" with options:
   - Use existing runtime (provide URL)
   - Use default runtime (from env var)
3. **Document isolation boundary**: Workspace files are isolated; runtime is shared unless user provides a different gateway URL
4. **Future: Docker orchestration**: Auto-provision per-team containers (out of scope for this pass)

---

## 4. Required Design Decisions

### Decision 1: Attach Contract

**Decided:** Attach requires gateway URL + workspace path + company name. Validation is deterministic (no AI inference for critical config). User confirms discovered agents before finalization.

### Decision 2: Discovery Model

**Decided:** Deterministic filesystem scanning only. Read `openclaw-agents-config.json`, enumerate folders, validate required files. No AI-assisted discovery for MVP. Discovery results are presented to user for confirmation before any DB writes.

### Decision 3: Multi-Team Runtime Model

**Decided:** Shared runtime with per-company gateway URL. Companies declare their gateway URL at creation/attach time. Multiple companies CAN share a gateway (default behavior) or use different gateways (user-provided). No auto-provisioning of Docker containers in this pass — documented as future capability.

### Decision 4: Product Truthfulness

**Decided:**
- "Attach Existing OpenClaw" = connect to YOUR running gateway + import YOUR workspace
- "Create New Team" = provision workspace from baseline + connect to a gateway YOU specify or the default
- UI will NOT claim to "start" or "provision" an OpenClaw runtime
- If isolated runtime is desired, user must set up separate Docker containers manually (documented)

---

## 5. Implementation Order

### Wave 1: Backend Foundation (3 parallel agents)

**Agent 2 (Attach Flow Engineer) + Agent 5 (Workspace Discovery Engineer):**
- Create `server/src/services/workspace-discovery.ts`: scan workspace path, parse config, enumerate agents, return discovery result
- Create attach API endpoints in a new route file `server/src/routes/attach.ts`:
  - `POST /api/attach/discover` — accept workspace path + gateway URL, return discovered agents
  - `POST /api/attach/confirm` — accept discovery result + company name, create company + agents
- Add shared types for discovery/attach in `packages/shared/src/types/attach.ts`
- Add Zod validators in `packages/shared/src/validators/attach.ts`

**Agent 4 (Provisioning Lifecycle Engineer):**
- Add `gatewayUrl` field to companies table (migration)
- Update `activateCompany()` to be callable standalone (not just from executeJob)
- Add `provisioningMode` field to provisioning jobs: `"cold_start"` | `"attach"`
- Ensure attach-mode companies go directly to `active` status (skip provisioning phases)

**Agent 6 (Generation/Bootstrap Content Engineer):**
- No changes needed for Wave 1 (generation only applies to cold-start mode)
- Review generation worker for any hardcoded assumptions about provisioning flow

### Wave 2: Frontend Flows (2 parallel agents)

**Agent 7 (Frontend Onboarding/UX Engineer):**
- Add mode chooser to entry point: "Attach Existing OpenClaw" vs "Create New Team"
- Build attach wizard: gateway URL → workspace path → discover → review agents → confirm → done
- Update BootstrapWizard with runtime selector: "Which gateway?" (default or custom URL)
- Add company name field to attach flow

**Agent 8 (Dashboard/Lifecycle Experience Engineer):**
- Show runtime context in dashboard (which gateway, workspace path)
- Add provisioning mode badge to company switcher ("Attached" vs "Provisioned") — now reads from `provisioning_mode` column (migration 0029), not log heuristic
- Add CompanySettings lifecycle guard (known debt from prior session)
- Show multi-team context clearly when multiple companies exist

### Wave 3: Review + Pressure Test (3 parallel agents)

**Agent 9 (Code Review):**
- Cross-file consistency: types, validators, routes, services, UI all aligned
- Race condition review on attach flow (duplicate company creation guard)
- Schema/API contract review

**Agent 10 (Adversarial Pressure Test):**
- Attach flow: invalid gateway, missing config file, malformed config, partial workspace
- Cold-start: second team with same name, third team with custom gateway
- Multi-team: select company A, verify workspace path doesn't leak to company B
- Stale state: attach to workspace that changes after import

**Agent 11 (QA/Integration Test):**
- Attach flow integration tests (discover + confirm)
- Multi-company provisioning tests
- Lifecycle state tests for attach-mode companies
- TypeScript compilation across all packages

### Wave 4: Final Acceptance (2 agents)

**Agent 12 (Final Productization Judge):**
- Product evaluation: can a new user understand attach vs create?
- Architecture evaluation: are runtime boundaries clear and truthful?
- Quality evaluation: test coverage, compilation, no regressions

**Agent 1 (Product Architect):**
- Final acceptance report
- Known debt inventory
- Recommendations for next pass

---

## 6. Agent Ownership Map

| Agent | Primary Responsibility | Key Files |
|-------|----------------------|-----------|
| **Agent 1** (Product Architect) | Plan, sequence, accept | This memo, final report |
| **Agent 2** (Attach Flow Engineer) | Attach backend | `routes/attach.ts`, attach service |
| **Agent 3** (Runtime Isolation) | Runtime model docs | Documentation, future architecture |
| **Agent 4** (Provisioning Lifecycle) | Lifecycle + DB | `provisioning.ts`, migration, company schema |
| **Agent 5** (Workspace Discovery) | Discovery service | `workspace-discovery.ts`, shared types |
| **Agent 6** (Generation/Bootstrap) | Generation review | `generation-worker.ts` (verify, no changes expected) |
| **Agent 7** (Frontend Onboarding UX) | Mode chooser + attach wizard | New UI components, BootstrapWizard update |
| **Agent 8** (Dashboard/Lifecycle UX) | Dashboard + settings | `Dashboard.tsx`, `CompanySettings.tsx`, `CompanySwitcher.tsx` |
| **Agent 9** (Code Review) | Review all waves | Review reports |
| **Agent 10** (Pressure Test) | Break everything | Pressure test scenarios |
| **Agent 11** (QA/Integration) | Automated tests | Test files |
| **Agent 12** (Final Judge) | Accept/reject | Final report |

---

## 7. Review and Testing Gates

### Gate 1: After Wave 1 (Backend Foundation)
- [ ] TypeScript compiles clean (shared, server)
- [ ] Discovery service returns correct results for valid workspace
- [ ] Discovery service returns clear errors for invalid workspace
- [ ] Attach endpoints create company + agents correctly
- [ ] Gateway health check works in attach flow
- [ ] Company has gatewayUrl field populated
- [ ] Attach-mode company goes directly to active status

### Gate 2: After Wave 2 (Frontend Flows)
- [ ] TypeScript compiles clean (UI)
- [ ] Mode chooser renders two clear options
- [ ] Attach wizard completes full flow (gateway → workspace → discover → confirm)
- [ ] BootstrapWizard shows runtime selector
- [ ] Dashboard shows runtime context for attached companies
- [ ] Company switcher shows mode badge
- [ ] CompanySettings has lifecycle guard

### Gate 3: After Wave 3 (Review + Pressure Test)
- [ ] Code review passes with no blocking findings
- [ ] All pressure test scenarios documented with verdicts
- [ ] No silent state corruption in any scenario
- [ ] Integration tests cover attach + cold-start + multi-team
- [ ] All existing tests still pass (45 provisioning + 48 onboarding)

### Gate 4: After Wave 4 (Final Acceptance)
- [ ] Product judge confirms UX is intuitive
- [ ] Architecture judge confirms runtime model is truthful
- [ ] Known debt is explicitly documented
- [ ] Final acceptance report signed off

---

## 8. Scope Boundaries

### In scope for this pass
- Attach-existing-OpenClaw as first-class flow (Mode A)
- Per-company gateway URL (runtime awareness)
- Mode chooser in onboarding entry point
- Runtime context in dashboard
- CompanySettings lifecycle guard
- Integration tests for both modes
- Documentation for both modes

### Explicitly out of scope
- Docker orchestration (auto-provisioning per-team containers)
- Per-team network isolation
- AI-assisted workspace discovery
- Agent duplication fix on retry (known debt from prior pass — needs unique constraint migration)
- Retry TOCTOU race condition (known debt — needs DB-level conditional update)
- Cloud deployment mode changes

### Future direction (documented, not implemented)
- Docker compose template generation for isolated runtimes
- Runtime registry/pool management
- Per-team container lifecycle (create, start, stop, destroy)
- Automated runtime migration between shared and isolated modes

---

## 9. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Attach flow creates company but gateway dies before completion | Medium | Medium | Attach creates company as "active" only after all validation passes. Gateway unreachable = attach blocked. |
| User attaches workspace that changes after import | Low | Low | Agent configs are snapshots at attach time. Drift detection is future work. |
| Second team accidentally uses first team's workspace path | Low | High | Workspace path is provided by user per-attach. Collision check before creation. |
| Mode chooser confuses users | Medium | Medium | Clear labels: "I have OpenClaw running" vs "Start fresh" |
| Migration adds gatewayUrl column and breaks existing queries | Low | Low | Column is nullable, no default changes to existing behavior |

---

## 10. Success Criteria

This pass succeeds if:

1. A user with an existing OpenClaw workspace can attach it through a guided wizard
2. A user can create a new team and see which gateway it uses
3. A user can create a second team and choose a different gateway if desired
4. The dashboard clearly shows whether a company was attached or provisioned
5. The UI never claims to "start" a runtime when it only attaches
6. All existing tests pass plus new tests cover attach flow
7. Known debt is documented, not hidden
