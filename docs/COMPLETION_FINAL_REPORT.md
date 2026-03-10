# OpenClaw Completion Mandate — Final Acceptance Report

**Date:** 2026-03-09
**Mandate:** CLAUDE_CODE_OPENCLAW_COMPLETION_MANDATE.md
**Phases completed:** 6 of 6

---

## 1. What Was Fixed

### Transaction Safety

| Operation | Before | After |
|-----------|--------|-------|
| `confirmAttach` (attach.ts) | 3 sequential writes, no transaction | Fully wrapped in `db.transaction()` |
| `activateCompany` (provisioning.ts) | N agent inserts + 2 updates, no transaction | Fully wrapped in `db.transaction()` |
| `retryJob` (provisioning.ts) | 2 updates, no transaction | Fully wrapped in `db.transaction()` |
| `executeJob` error handler (provisioning.ts) | 2 failure updates, no transaction | Fully wrapped in `db.transaction()` |

### Uniqueness Constraints

| Constraint | Table | Columns | Purpose |
|-----------|-------|---------|---------|
| `agents_company_name_uniq` | agents | (company_id, name) | Prevents duplicate agents per company |
| `companies_name_uniq` | companies | (name) | Prevents duplicate company names |

### Provisioning Mode Truth

| Before | After |
|--------|-------|
| Dashboard scanned log messages for the word "attach" | `provisioningMode` column on `provisioning_jobs` — explicit values: `cold_start` or `attach` |
| No runtime mode concept | `runtimeMode` column on `provisioning_jobs` — values: `shared`, `dedicated`, `unknown` |
| Mode only in API response, not persisted | Both columns persisted at job creation time |

### Dead Code Elimination

| Before | After |
|--------|-------|
| `.onConflictDoNothing()` on agents with no backing constraint (silent no-op) | `.onConflictDoNothing()` backed by `agents_company_name_uniq` constraint (real idempotency) |
| TOCTOU company name check in `confirmAttach` (SELECT then throw) | DB constraint `companies_name_uniq` handles conflict; caught and re-thrown as friendly error |

---

## 2. Schema Changes (Migration 0029)

**File:** `packages/db/src/migrations/0029_completion_hardening.sql`

```sql
-- New columns
ALTER TABLE provisioning_jobs ADD COLUMN provisioning_mode text NOT NULL DEFAULT 'cold_start';
ALTER TABLE provisioning_jobs ADD COLUMN runtime_mode text NOT NULL DEFAULT 'shared';

-- Agent uniqueness (with dedup of existing data)
DELETE FROM agents a1 USING agents a2
  WHERE a1.company_id = a2.company_id AND a1.name = a2.name AND a1.created_at > a2.created_at;
CREATE UNIQUE INDEX agents_company_name_uniq ON agents(company_id, name);

-- Company name uniqueness (with dedup of existing data)
UPDATE companies SET name = name || ' (' || substring(id::text, 1, 8) || ')'
  WHERE id IN (SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY name ORDER BY created_at) as rn FROM companies
  ) t WHERE rn > 1);
CREATE UNIQUE INDEX companies_name_uniq ON companies(name);
```

**Drizzle schema files updated:**
- `packages/db/src/schema/provisioning_jobs.ts` — added `provisioningMode` and `runtimeMode` columns
- `packages/db/src/schema/agents.ts` — added `companyNameUniq` unique index
- `packages/db/src/schema/companies.ts` — added `nameUniq` unique index

---

## 3. Design Decisions Made

### Decision 1: Canonical provisioning mode
`provisioningMode` column on `provisioning_jobs` with values `"cold_start"` | `"attach"`. Default `"cold_start"` for back-compat. Set explicitly at job creation — no heuristics.

### Decision 2: Runtime relationship model
The provisioning job IS the runtime relationship record. No separate `runtimes` table. `runtimeMode` column with values `"shared"` | `"dedicated"` | `"unknown"`. Default `"shared"` — honest representation of current capability.

### Decision 3: Agent uniqueness
Unique constraint on `agents(company_id, name)`. Duplicate agents prevented at DB level. `.onConflictDoNothing()` now provides real idempotency for retry scenarios.

### Decision 4: Company identity
Unique constraint on `companies(name)`. Eliminates TOCTOU race condition. Constraint violations caught and re-thrown as user-friendly conflict errors.

### Decision 5: Isolated runtime support level
**Not yet implemented, represented in model/docs only.** The `runtime_mode` column can hold `"dedicated"` when an operator provisions a separate gateway. Paperclip does NOT launch containers. Documentation states this clearly.

---

## 4. Runtime Model — Officially Supported

| Capability | Status |
|-----------|--------|
| Single company with shared gateway | Supported |
| Multiple companies with same gateway URL | Supported |
| Multiple companies with different gateway URLs | Supported |
| `provisioningMode` tracking (cold_start vs attach) | Supported |
| `runtimeMode` label (shared/dedicated) | Supported |
| Automatic container orchestration per team | Not implemented |
| Runtime isolation enforcement between teams | Not implemented |

The system operates on a **shared gateway, per-company workspace** model. Each company records which gateway URL it uses. Multiple companies can share or use different gateways. Workspace isolation is filesystem-based (each company gets its own directory). The UI truthfully represents what mode each company uses.

---

## 5. Multi-Team Behavior — Now Supported

| Behavior | Status |
|----------|--------|
| Create multiple companies via attach or cold-start | Works |
| Each company shows its own provisioning mode | Works (via `provisioningMode` column) |
| Each company shows its runtime mode | Works (via `runtimeMode` column) |
| Dashboard shows gateway URL and workspace per company | Works |
| Company switching in sidebar | Works (existing) |
| Duplicate company names prevented | Enforced by DB constraint |
| Duplicate agents within company prevented | Enforced by DB constraint |

---

## 6. Quality Assessment

### Test Coverage

| Test File | Tests | Status |
|-----------|-------|--------|
| `provisioning.test.ts` | 28 | All pass |
| `provisioning-service.test.ts` | 17 | All pass |
| `onboarding-routes.test.ts` | 48 | All pass |
| `attach.test.ts` | 27 | All pass |
| `completion-hardening.test.ts` | 12 | All pass |
| **Total** | **132** | **All pass** |

### New Tests (completion-hardening.test.ts)

1. Transaction wrapping for `confirmAttach`
2. Transaction rollback on agent insertion failure
3. Atomic creation of company + job + agents
4. Duplicate company name rejection via DB constraint
5. Combined name + prefix conflict handling
6. `provisioningMode: "attach"` on attach jobs
7. `runtimeMode: "shared"` on attach jobs
8. `provisioningMode: "cold_start"` on cold-start jobs
9. Agent idempotency via `onConflictDoNothing`
10. Duplicate agent name handling
11. Transaction wrapping for `retryJob`
12. Transaction wrapping for `activateCompany`

### TypeScript Compilation

| Package | Status |
|---------|--------|
| `packages/shared` | Clean |
| `packages/db` | Clean |
| `server` | Clean |
| `ui` | Clean |

---

## 7. Files Changed

### New Files (3)

| File | Purpose |
|------|---------|
| `packages/db/src/migrations/0029_completion_hardening.sql` | Schema migration |
| `server/src/__tests__/completion-hardening.test.ts` | 12 hardening tests |
| `docs/COMPLETION_ARCHITECTURE_MEMO.md` | Phase 1 architecture memo |

### Modified Files (12)

| File | Change |
|------|--------|
| `packages/db/src/schema/provisioning_jobs.ts` | Added `provisioningMode`, `runtimeMode` columns |
| `packages/db/src/schema/agents.ts` | Added `companyNameUniq` unique index |
| `packages/db/src/schema/companies.ts` | Added `nameUniq` unique index |
| `packages/shared/src/types/provisioning.ts` | Added `ProvisioningMode`, `RuntimeMode` types; updated `ProvisioningJob` interface |
| `packages/shared/src/types/index.ts` | Added `RuntimeMode` export |
| `packages/shared/src/index.ts` | Added `RuntimeMode` barrel export |
| `server/src/services/attach.ts` | Transaction wrapping, constraint-based conflict, `provisioningMode`/`runtimeMode` |
| `server/src/services/provisioning.ts` | Transaction wrapping (3 functions), `provisioningMode`/`runtimeMode` on job creation |
| `server/src/__tests__/attach.test.ts` | Added `transaction` to mock DB, company name uniqueness simulation |
| `server/src/__tests__/provisioning-service.test.ts` | Added `transaction` to mock DB |
| `ui/src/pages/Dashboard.tsx` | Replaced heuristic mode detection with column read; added runtime mode label |
| `ui/src/pages/AttachWizard.tsx` | Added "Back to options" link on step 0 |
| `ui/src/pages/CompanySettings.tsx` | Added Infrastructure section showing provisioning/runtime mode |

---

## 8. Known Debt Remaining

| Item | Severity | Status |
|------|----------|--------|
| Container orchestration per team | Feature gap | Documented as "not implemented" — `runtimeMode` column ready for when it is |
| Path traversal in discover endpoint | Low | Acceptable in `local_trusted` mode |
| Wizard state lost on refresh | Low | React useState only; sessionStorage would improve |
| `importBundle` not transactional | Medium | Separate feature path, not in mandate scope |
| Distributed locking for prefix allocation | Low | Retry loop sufficient for current scale |

---

## 9. Completion Verdict

### Is the product materially closer to production quality?

**YES.** Specifically:

1. **Attach writes are transaction-safe.** `confirmAttach` wraps company + job + agents in a single `db.transaction()`. Partial state from mid-operation failures is eliminated.

2. **Provisioning mode is represented by explicit system truth.** The `provisioningMode` column on `provisioning_jobs` replaces the log-message heuristic. Dashboard reads the column directly.

3. **Runtime/team relationships are clearer.** The `runtimeMode` column explicitly labels each company's runtime as shared or dedicated. Dashboard and Settings show this information.

4. **Duplicate creation is materially harder.** `agents_company_name_uniq` prevents duplicate agents. `companies_name_uniq` prevents duplicate company names. The TOCTOU race condition is eliminated.

5. **Multi-team behavior is better defined.** Each company has its own provisioning mode and runtime mode. Dashboard shows per-company runtime context. Users can tell whether teams share infrastructure.

6. **Tests cover the new integrity concerns.** 12 new tests verify transaction wrapping, rollback, constraint enforcement, and mode persistence. 132 total tests pass with zero regressions.

7. **The product is truthful about what it does and doesn't do.** Isolated runtime is explicitly documented as "not yet implemented." Runtime mode defaults to "shared." No false claims about container orchestration.

### Success Metrics Assessment

| Metric | Met? |
|--------|------|
| Attach confirmation cannot leave partial writes on ordinary failure paths | Yes |
| Duplicate-agent creation is materially harder | Yes (DB constraint) |
| Provisioning mode is represented by explicit system truth | Yes (column, not heuristic) |
| Retry behavior is safer | Yes (transactional) |
| Product can represent more than one team clearly | Yes |
| Runtime relationships are understandable | Yes (shared/dedicated labels) |
| Users can tell whether teams share runtime infrastructure | Yes (Dashboard + Settings) |
| Onboarding language is clearer | Yes (back link, mode labels) |
| Dashboard/settings show authoritative runtime context | Yes |
| All relevant packages compile | Yes |
| New tests cover hardened behaviors | Yes (12 new tests) |
| Docs match real behavior | Yes |
