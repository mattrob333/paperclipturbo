# OpenClaw Completion Architecture Memo

**Date:** 2026-03-09
**Phase:** 1 of 6 (Completion Mandate)
**Authors:** Principal Finisher (Agent 1), Code Review Engineer (Agent 7), Adversarial Systems Engineer (Agent 8)

---

## 1. What Is Already Solid (Do Not Regress)

| Area | Status | Evidence |
|------|--------|----------|
| 6-phase provisioning pipeline | Stable | 28 tests pass, sequential phase execution works |
| Attach-existing-OpenClaw wizard | Stable | 27 tests pass, 4-step UI flow functional |
| Mode chooser at `/get-started` | Stable | Routes to attach or bootstrap correctly |
| Company lifecycle states | Stable | draft/provisioning/active/failed/paused/archived with guards |
| Dashboard runtime info bar | Stable | Shows gateway URL, workspace path, mode badge |
| CompanySettings lifecycle guard | Stable | Non-active companies blocked from full settings |
| Workspace discovery (read-only) | Stable | Filesystem scanning with agent status classification |
| Gateway health check | Stable | HTTP check with 10s timeout |
| Issue prefix uniqueness | Stable | `companies_issue_prefix_idx` enforced by DB |
| Company deletion cascade | Stable | Fully transactional (27 cascading deletes) |
| Agent deletion cascade | Stable | Fully transactional (6 child table deletes) |
| Secret create/rotate | Stable | Fully transactional |
| Heartbeat queue/promote | Stable | Fully transactional |

**Test baseline:** 120 tests across 4 files (28 provisioning, 17 provisioning-service, 48 onboarding, 27 attach). All pass. TypeScript compiles clean across shared, server, and ui packages.

---

## 2. Highest-Priority Integrity Risks

### Risk 1: CRITICAL — `confirmAttach` is not transactional

**What happens:** `attach.ts:confirmAttach()` performs 3+ sequential writes:
1. `INSERT companies` (with issue prefix retry loop)
2. `INSERT provisioning_jobs`
3. `INSERT agents` (N times in a loop)

None are wrapped in `db.transaction()`. A failure at step 3 leaves a company and provisioning job with no agents. The result reports success with `agentsCreated: N` even if some agent inserts silently failed via `.onConflictDoNothing()`.

**Impact:** Partial state — company exists as "active" with missing agents. No recovery path.

### Risk 2: CRITICAL — `activateCompany` is not transactional

**What happens:** `provisioning.ts:activateCompany()` performs:
1. `INSERT agents` (N times via loop with `.onConflictDoNothing()`)
2. `UPDATE companies` (set status = "active")
3. `UPDATE provisioning_jobs` (set status = "completed")

Same risk as confirmAttach — partial agent creation with silent failures.

**Impact:** Company marked "active" and job marked "completed" but some agents missing.

### Risk 3: HIGH — Company name has no unique constraint

**What happens:** `companies.name` has no `uniqueIndex`. The check in `attach.ts:59-63` (SELECT then throw) is a TOCTOU race. Two concurrent `confirmAttach` calls with the same company name can both succeed, creating duplicate companies.

**Impact:** Duplicate companies in database. UI shows both. No way to distinguish or merge.

### Risk 4: HIGH — Agent table has no uniqueness constraint

**What happens:** `agents` table has no unique constraint on `(company_id, name)` or any other composite. The `.onConflictDoNothing()` calls in `attach.ts:176` and `provisioning.ts:429` reference no real constraint — they only conflict on the UUID primary key (which is always unique since it's `defaultRandom()`).

**Impact:** `.onConflictDoNothing()` is effectively dead code. Duplicate agents can be created for the same company with the same name. Retry of provisioning or attach creates additional duplicates.

### Risk 5: HIGH — `retryJob` has no transaction or atomicity

**What happens:** `provisioning.ts:retryJob()` performs:
1. `UPDATE provisioning_jobs` (reset to "queued")
2. `UPDATE companies` (reset to "provisioning")

If step 2 fails, job is "queued" but company is still "failed" or "active".

**Impact:** Inconsistent state between job and company.

### Risk 6: MEDIUM — Provisioning mode is heuristic

> **RESOLVED (migration 0029).** A `provisioning_mode` column was added to `provisioning_jobs`. Dashboard now reads this column directly. The log-scanning heuristic described below has been removed.

**What happens (historical):** Dashboard detected "Attached" vs "Provisioned" by scanning log messages for the word "attach" (`Dashboard.tsx:95-101`). No dedicated column persisted this.

**Impact (historical):** Fragile -- any log message containing "attach" triggered the wrong mode label. Log format changes broke detection. Could not query by mode.

### Risk 7: MEDIUM — `executeJob` error handling is not transactional

**What happens:** `provisioning.ts:executeJob()` catch block performs:
1. `UPDATE provisioning_jobs` (set status = "failed")
2. `UPDATE companies` (set status = "failed")

These are separate writes — if step 2 fails, job is "failed" but company is in unknown state.

---

## 3. Runtime Model Ambiguities

### Ambiguity 1: No persisted runtime relationship

The system has no explicit table or column representing the relationship between a company and its runtime. Currently:
- `gatewayUrl` is stored only on `provisioning_jobs`
- `workspacePath` is stored only on `provisioning_jobs`
- Agents store `gatewayUrl` in `adapterConfig` JSONB (untyped)

To answer "what gateway does Company X use?", you must query the latest provisioning job and extract its `gatewayUrl`. There is no canonical runtime relationship.

### Ambiguity 2: No runtime mode concept

The system does not distinguish between "shared runtime" and "isolated runtime". All companies use whatever gateway URL was provided at provisioning or attach time. Multiple companies can share the same gateway URL, but the system does not know or represent this.

### Ambiguity 3: Provisioning mode not persisted

> **RESOLVED (migration 0029).** A `provisioning_mode` column now exists on `provisioning_jobs` with values `"cold_start"` | `"attach"`, set explicitly at job creation time. The log-entry heuristic described below has been replaced.

Previously there was no `provisioning_mode` column on `provisioning_jobs` or `companies`. The only signal was:
- `attach.ts` returns `provisioningMode: "attach"` in the API response
- The log entries in the provisioning job contain the word "attach"

This was not queryable, not reliable, and not explicit.

### Ambiguity 4: Multi-team gateway sharing is implicit

Two companies can have the same `gatewayUrl` without the system knowing they share a runtime. There is no concept of "runtime instance" or "gateway registration" — each company independently stores its gateway URL.

---

## 4. Design Decisions

### Decision 1: Canonical provisioning mode representation

> **IMPLEMENTED (migration 0029).** This decision has been implemented. The column exists and Dashboard reads it directly.

**Decision:** Add a `provisioning_mode` column to `provisioning_jobs` table.

- Type: `text`, values: `"cold_start"` | `"attach"`
- Default: `"cold_start"` (for existing rows)
- Set explicitly at job creation time — `"attach"` for attach flow, `"cold_start"` for provisioning flow
- Dashboard reads this column directly instead of scanning log messages
- Migration: `ALTER TABLE provisioning_jobs ADD COLUMN provisioning_mode text NOT NULL DEFAULT 'cold_start'`

**Rationale:** Simple column addition. No heuristics. Queryable. Back-compatible (default covers existing data).

### Decision 2: Runtime relationship model

**Decision:** The runtime relationship is the provisioning job itself. We do NOT create a separate `runtimes` table for this pass.

- `provisioning_jobs` already stores `gatewayUrl` and `workspacePath` per company
- The latest completed job for a company is the canonical runtime relationship
- API and UI should query this explicitly rather than reconstructing it from agents

**Rationale:** A separate `runtimes` or `runtime_instances` table would be premature. The provisioning job already contains all runtime metadata. The completion mandate says to be truthful — we do not orchestrate containers, so a "runtime" entity would be misleading.

**What we add:** A `runtime_mode` column on `provisioning_jobs`:
- Type: `text`, values: `"shared"` | `"dedicated"` | `"unknown"`
- Default: `"shared"` (honest — all current deployments share a gateway)
- Meaning: `"shared"` = gateway serves multiple companies; `"dedicated"` = gateway serves one company; `"unknown"` = not yet classified

### Decision 3: Agent uniqueness model

**Decision:** Add a unique constraint on `agents(company_id, name)`.

- Migration: `CREATE UNIQUE INDEX agents_company_name_uniq ON agents(company_id, name)`
- This makes `.onConflictDoNothing()` meaningful — duplicate agent inserts are idempotent
- Service code updated to handle the constraint violation explicitly where needed
- Existing data must be deduplicated if any duplicates exist (migration includes dedup step)

**Rationale:** Agent names must be unique within a company. The current lack of constraint allows silent duplicate creation. The constraint makes `.onConflictDoNothing()` work as intended.

### Decision 4: Company identity and attach conflict model

**Decision:** Add a unique constraint on `companies(name)`.

- Migration: `CREATE UNIQUE INDEX companies_name_uniq ON companies(name)`
- Remove the application-level TOCTOU check in `attach.ts:59-63` and `companies.ts`
- Replace with `INSERT ... ON CONFLICT (name) DO NOTHING` or catch the constraint violation
- Existing data must be checked for duplicates before migration

**Rationale:** Company names should be globally unique. The current application-level check is racy. A DB constraint eliminates the race.

### Decision 5: Isolated runtime support level

**Decision:** **Not yet implemented, represented in model/docs only.**

- The `runtime_mode` column on `provisioning_jobs` can be set to `"dedicated"` when the operator provisions a dedicated gateway
- Paperclip does NOT launch, start, or manage gateway containers
- The system truthfully represents what mode each company uses
- Documentation explicitly states that isolated runtime orchestration is operator-assisted, not automated

---

## 5. Highest-Value Schema Changes

### Migration 0029: Completion hardening

```sql
-- 1. Add provisioning_mode column
ALTER TABLE provisioning_jobs
  ADD COLUMN provisioning_mode text NOT NULL DEFAULT 'cold_start';

-- 2. Add runtime_mode column
ALTER TABLE provisioning_jobs
  ADD COLUMN runtime_mode text NOT NULL DEFAULT 'shared';

-- 3. Add agent uniqueness constraint (with dedup)
-- First, remove duplicates keeping the earliest created
DELETE FROM agents a1
  USING agents a2
  WHERE a1.company_id = a2.company_id
    AND a1.name = a2.name
    AND a1.created_at > a2.created_at;

CREATE UNIQUE INDEX agents_company_name_uniq ON agents(company_id, name);

-- 4. Add company name uniqueness (with dedup)
-- First, check for duplicates and rename with suffix
UPDATE companies
  SET name = name || ' (' || substring(id::text, 1, 8) || ')'
  WHERE id IN (
    SELECT id FROM (
      SELECT id, ROW_NUMBER() OVER (PARTITION BY name ORDER BY created_at) as rn
      FROM companies
    ) t WHERE rn > 1
  );

CREATE UNIQUE INDEX companies_name_uniq ON companies(name);
```

### Schema changes in Drizzle

**`packages/db/src/schema/agents.ts`:** Add `companyNameUniq` unique index on `(companyId, name)`

**`packages/db/src/schema/companies.ts`:** Add `nameUniq` unique index on `(name)`

**`packages/db/src/schema/provisioning_jobs.ts`:** Add `provisioningMode` and `runtimeMode` columns

---

## 6. Required Code Changes

### Phase 2 targets (Transaction + Persistence hardening)

| File | Change | Owner |
|------|--------|-------|
| `server/src/services/attach.ts` | Wrap entire `confirmAttach` in `db.transaction()` | Agent 2 |
| `server/src/services/attach.ts` | Set `provisioningMode: "attach"` on job insert | Agent 2 |
| `server/src/services/attach.ts` | Replace SELECT-then-throw with constraint-based conflict handling | Agent 2 |
| `server/src/services/provisioning.ts` | Wrap `activateCompany` agent loop + company update in transaction | Agent 2 |
| `server/src/services/provisioning.ts` | Wrap `retryJob` two updates in transaction | Agent 2 |
| `server/src/services/provisioning.ts` | Set `provisioningMode: "cold_start"` on job creation | Agent 5 |
| `server/src/services/provisioning.ts` | Wrap `executeJob` error handler in transaction | Agent 5 |
| `packages/db/src/schema/agents.ts` | Add `companyNameUniq` unique index | Agent 2 |
| `packages/db/src/schema/companies.ts` | Add `nameUniq` unique index | Agent 2 |
| `packages/db/src/schema/provisioning_jobs.ts` | Add `provisioningMode` and `runtimeMode` columns | Agent 2 |
| `packages/db/src/migrations/0029_*.sql` | Migration SQL | Agent 2 |

### Phase 3 targets (Runtime model truth)

| File | Change | Owner |
|------|--------|-------|
| `server/src/services/provisioning.ts` | Expose `provisioningMode` and `runtimeMode` in job responses | Agent 3 |
| `server/src/routes/provisioning.ts` | Include new fields in API responses | Agent 3 |
| `packages/shared/src/types/provisioning.ts` | Add `provisioningMode` and `runtimeMode` to types | Agent 3 |
| `ui/src/pages/Dashboard.tsx` | Replace heuristic mode detection with `provJob.provisioningMode` | Agent 6 |
| `ui/src/pages/Dashboard.tsx` | Show runtime mode (shared/dedicated) in info bar | Agent 6 |

### Phase 4 targets (UX hardening)

| File | Change | Owner |
|------|--------|-------|
| `ui/src/pages/Dashboard.tsx` | Show runtime mode label and team gateway association | Agent 6 |
| `ui/src/pages/CompanySettings.tsx` | Show provisioning mode and runtime mode in settings | Agent 6 |
| `ui/src/pages/AttachWizard.tsx` | Handle constraint violation errors (duplicate company name) | Agent 6 |
| `ui/src/pages/AttachWizard.tsx` | Add back link to mode chooser on step 0 | Agent 6 |

---

## 7. Agent Ownership Map

| Agent | Role | Scope |
|-------|------|-------|
| Agent 1 (Principal Finisher) | Orchestration, acceptance gates | Scoping, sequencing, review |
| Agent 2 (Transaction Engineer) | DB integrity | Schema, migrations, transactions, constraints |
| Agent 3 (Runtime Model Engineer) | Runtime truth | Provisioning mode/runtime mode columns, API exposure |
| Agent 5 (Lifecycle Engineer) | Provisioning lifecycle | Retry hardening, error handler transactions, mode storage |
| Agent 6 (Frontend UX) | UI clarity | Dashboard mode display, settings, error handling |
| Agent 7 (Code Reviewer) | Architecture review | Post-wave review gates |
| Agent 8 (Adversarial Tester) | Breaking assumptions | Concurrency, duplicate, race condition tests |
| Agent 9 (QA Engineer) | Test coverage | New tests for constraints, transactions, multi-team |

Agents 4 (Container Engineer) and 10 (Final Judge) are deferred — Agent 4 is not needed (Decision 5: no container orchestration) and Agent 10 participates in Phase 6 only.

---

## 8. Review and Testing Gates

### Gate 1: Post-Phase 2 (after transaction + schema hardening)

- [ ] All 3 packages compile clean
- [ ] All existing 120 tests pass (no regressions)
- [ ] New migration applies cleanly to existing data
- [ ] `confirmAttach` is fully transactional (verified by test)
- [ ] `activateCompany` is fully transactional (verified by test)
- [ ] `retryJob` is fully transactional (verified by test)
- [ ] Agent uniqueness constraint prevents duplicate creation (verified by test)
- [ ] Company name uniqueness constraint prevents duplicate companies (verified by test)
- [ ] `.onConflictDoNothing()` on agents is now meaningful (backed by constraint)

### Gate 2: Post-Phase 3 (after runtime model truth)

- [x] `provisioningMode` is persisted on job creation (attach and cold_start)
- [x] `runtimeMode` is persisted and exposed via API
- [x] Dashboard reads `provisioningMode` from column, not from log heuristic
- [x] Types updated in shared package
- [x] No heuristic mode detection remains

### Gate 3: Post-Phase 4 (after UX hardening)

- [ ] Dashboard shows runtime mode clearly
- [ ] Settings show provisioning mode and runtime mode
- [ ] AttachWizard handles duplicate company name error gracefully
- [ ] AttachWizard has back link on step 0
- [ ] Multi-team switching shows correct runtime context per company

### Gate 4: Post-Phase 5 (after pressure testing)

- [ ] Concurrent attach requests with same name: one succeeds, one fails cleanly
- [ ] Partial failure during attach transaction: all writes rolled back
- [ ] Duplicate agent creation prevented by constraint
- [ ] Retry race: no inconsistent state
- [ ] Multiple teams sharing one gateway: correctly represented
- [ ] Multiple teams with distinct gateways: correctly represented

---

## 9. Implementation Order

```
Phase 2: Schema + Transaction Hardening
  ├─ Migration 0029 (schema changes)
  ├─ confirmAttach transaction wrapping
  ├─ activateCompany transaction wrapping
  ├─ retryJob transaction wrapping
  ├─ executeJob error handler transaction
  └─ Gate 1 verification

Phase 3: Runtime Model Truth
  ├─ Set provisioningMode on job creation (both flows)
  ├─ Expose new columns in API responses
  ├─ Update shared types
  └─ Gate 2 verification

Phase 4: UX Hardening
  ├─ Dashboard: replace heuristic with column read
  ├─ Dashboard: show runtime mode
  ├─ Settings: show provisioning/runtime mode
  ├─ AttachWizard: error handling + back link
  └─ Gate 3 verification

Phase 5: Pressure Testing
  ├─ Concurrency tests
  ├─ Transaction rollback tests
  ├─ Constraint violation tests
  ├─ Multi-team tests
  └─ Gate 4 verification

Phase 6: Final Acceptance
  └─ Completion report
```

---

## 10. What Remains As Deliberate Future Work

| Item | Reason for Deferral |
|------|-------------------|
| Container orchestration per team | No safe implementation path in this pass; represented in model only |
| Distributed locking for issue prefix allocation | Low probability of collision; retry loop is sufficient |
| Path traversal protection in discover endpoint | Only relevant in authenticated multi-user mode (not current deployment) |
| Wizard state persistence in sessionStorage | Low severity UX issue |
| `importBundle` transaction wrapping | Separate feature path, not in completion mandate scope |
