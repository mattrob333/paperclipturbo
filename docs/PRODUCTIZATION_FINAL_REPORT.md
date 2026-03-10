# OpenClaw Productization — Final Acceptance Report

**Date:** 2026-03-09
**Author:** Final Productization Judge (Agent 12) + Product Architect (Agent 1)
**Mandate:** CLAUDE_CODE_OPENCLAW_PRODUCTIZATION_MANDATE.md

---

## 1. Product Improvements Delivered

### Mode A: Attach Existing OpenClaw — DELIVERED

A user with an existing OpenClaw environment can now:

1. Navigate to `/get-started` and choose "Attach Existing OpenClaw"
2. Provide their gateway URL and workspace path
3. Click "Discover" to scan the workspace
4. Review discovered agents with completeness status (complete/partial/missing)
5. Select/deselect agents to import
6. Provide a company name and description
7. Confirm the attachment
8. Land on the dashboard with the attached company active

**Files created:**
| File | Purpose |
|------|---------|
| `packages/shared/src/types/attach.ts` | 6 TypeScript interfaces for attach flow |
| `packages/shared/src/validators/attach.ts` | 2 Zod schemas (discover + confirm) |
| `server/src/services/workspace-discovery.ts` | Filesystem scanner for OpenClaw workspaces |
| `server/src/services/attach.ts` | DB service for creating company + agents from discovery |
| `server/src/routes/attach.ts` | 2 API endpoints (`/discover`, `/confirm`) |
| `ui/src/api/attach.ts` | API client for attach endpoints |
| `ui/src/pages/AttachWizard.tsx` | 4-step wizard UI (connect → discover → name → success) |
| `ui/src/pages/OnboardingModeChooser.tsx` | Mode selection page (attach vs create) |

### Mode B: Cold-Start New Team — ENHANCED

The existing cold-start flow continues to work unchanged via `/bootstrap`. New improvements:

- Mode chooser (`/get-started`) routes users to the correct flow
- Dashboard now shows runtime context (gateway URL, workspace path, provisioning mode)
- CompanySettings has lifecycle guard for non-active companies

### Dashboard / Lifecycle UX — IMPROVED

- **Runtime info bar**: Dashboard shows gateway URL, workspace path, and "Attached" vs "Provisioned" badge for active companies
- **CompanySettings lifecycle guard**: Non-active companies (provisioning/draft/failed) see a status banner instead of the full settings form — closes known debt from the bootstrap fix
- **New user flow**: First visit redirects to `/get-started` mode chooser instead of directly opening the onboarding wizard

---

## 2. System Behaviors Now Supported

| Behavior | Status | Notes |
|----------|--------|-------|
| Attach existing OpenClaw workspace | Supported | Full discovery + confirm flow |
| Cold-start new team | Supported | Unchanged, works via `/bootstrap` |
| Mode selection on first visit | Supported | `/get-started` with two clear options |
| Gateway health check in attach flow | Supported | Shows green/red status, non-blocking |
| Workspace discovery with agent enumeration | Supported | Reads config, checks folders/files |
| Agent selection during attach | Supported | Checkboxes, missing agents disabled |
| Dashboard runtime context | Supported | Gateway URL, workspace path, mode badge |
| CompanySettings lifecycle guard | Supported | Non-active companies blocked from settings |
| Multiple companies on same gateway | Supported | Each company stores its own gateway URL |
| Company with custom gateway URL | Supported | User provides URL during attach or bootstrap |

---

## 3. Architecture Truthfulness Assessment

### What the system says vs what it does

| Claim | Truth |
|-------|-------|
| "Attach Existing OpenClaw" | Truthful. Scans YOUR workspace, health-checks YOUR gateway, imports YOUR agents. No hidden side effects. |
| "Create New Team" | Truthful. Provisions workspace from baseline template, connects to a gateway you specify or the default. |
| Provisioning mode badge ("Attached" / "Provisioned") | Truthful. Read from the `provisioning_mode` column on `provisioning_jobs` (added in migration 0029). Previously derived from log-entry heuristics; now column-based. |
| Gateway health status | Truthful. Real HTTP health check with 10-second timeout. |
| Agent status (complete/partial/missing) | Truthful. Based on actual filesystem checks for required files. |

### Runtime model

The system operates on a **shared runtime, per-company gateway URL** model:
- Each company records which gateway URL it uses
- Multiple companies CAN share the same gateway
- Multiple companies CAN use different gateways
- The UI does NOT claim to "start" or "provision" OpenClaw runtimes
- Workspace isolation is file-based (each company has its own directory)

This is truthful and clearly documented.

---

## 4. Quality Assessment

### Test Coverage

| Test File | Tests | Status |
|-----------|-------|--------|
| `provisioning.test.ts` | 28 | All pass |
| `provisioning-service.test.ts` | 17 | All pass |
| `onboarding-routes.test.ts` | 48 | All pass |
| `attach.test.ts` | 27 | All pass |
| **Total** | **120** | **All pass** |

### TypeScript Compilation

| Package | Status |
|---------|--------|
| `packages/shared` | Clean |
| `server` | Clean |
| `ui` | Clean |

### Code Review Summary

- No BLOCKING findings
- 6 IMPORTANT findings addressed or documented as known debt
- Cache invalidation after attach: **Fixed** (queryClient.invalidateQueries)
- Empty selectedAgentFolders semantics: **Fixed** (empty array now treated as "select none")
- snake_case variable name: **Fixed** (discovery_result → discoveryResult)

### Pressure Test Summary

- 25 scenarios tested
- 20 PASS, 1 FAIL (documented as known debt), 4 RISK (documented)
- All failure/error paths produce clear user-facing messages

---

## 5. Known Debt

### From This Pass

| Item | Severity | Description |
|------|----------|-------------|
| Race condition on company name | Medium | TOCTOU between SELECT and INSERT. No unique constraint on `companies.name`. Two concurrent `confirmAttach` calls with the same name can both succeed. Mitigated by UI (button disabled during pending). Fix: add unique constraint on `companies.name` or use transaction with advisory lock. |
| No transaction in confirmAttach | Medium | Company, provisioning job, and agent inserts are not wrapped in a DB transaction. A crash mid-operation could leave partial state. Fix: wrap in `db.transaction()`. |
| Path traversal in discover endpoint | Low | The discover endpoint accepts arbitrary filesystem paths. In `local_trusted` mode this is acceptable (user has local access). In `authenticated` mode, could leak directory existence info. Fix: validate path is under an allowed base directory. |
| Provisioning mode detection is heuristic | Low | **RESOLVED (migration 0029).** Dashboard now reads the `provisioning_mode` column on `provisioning_jobs` instead of scanning log messages. |
| Wizard state lost on refresh | Low | Attach wizard holds all state in React useState. Browser refresh resets to step 0. Post-success refresh could confuse users (company exists but wizard shows step 0). Fix: persist state in sessionStorage. |
| No cancel/back link on step 0 | Low | AttachWizard step 0 has no way to return to the mode chooser except browser back button. |
| onConflictDoNothing is dead code | Low | The agents table has no unique constraint on `(companyId, name)`, making `.onConflictDoNothing()` ineffective (UUID is always unique). Same issue exists in provisioning.ts. |

### Carried From Prior Pass

| Item | Severity | Description |
|------|----------|-------------|
| Agent duplication on retry | Medium | No unique constraint on agents table. Prior known debt. |
| Retry TOCTOU race condition | Medium | retryJob status check is not atomic. Prior known debt. |

---

## 6. Files Changed Summary

### New Files (10)

| File | Lines | Purpose |
|------|-------|---------|
| `packages/shared/src/types/attach.ts` | 53 | Attach flow TypeScript interfaces |
| `packages/shared/src/validators/attach.ts` | 18 | Zod schemas for discover + confirm |
| `server/src/services/workspace-discovery.ts` | 303 | Workspace scanning + gateway health check |
| `server/src/services/attach.ts` | 192 | Attach confirmation DB operations |
| `server/src/routes/attach.ts` | 96 | API endpoints for discover + confirm |
| `server/src/__tests__/attach.test.ts` | ~400 | 27 integration tests |
| `ui/src/api/attach.ts` | 22 | API client for attach endpoints |
| `ui/src/pages/AttachWizard.tsx` | 667 | 4-step attach wizard |
| `ui/src/pages/OnboardingModeChooser.tsx` | ~60 | Mode selection page |
| `docs/PRODUCTIZATION_ARCHITECTURE_MEMO.md` | ~350 | Phase 1 architecture memo |

### Modified Files (7)

| File | Change |
|------|--------|
| `packages/shared/src/types/index.ts` | Added attach type exports |
| `packages/shared/src/validators/index.ts` | Added attach validator exports |
| `packages/shared/src/index.ts` | Added barrel exports |
| `server/src/app.ts` | Registered attach routes |
| `server/src/services/index.ts` | Exported new services |
| `ui/src/App.tsx` | Added routes, updated CompanyRootRedirect |
| `ui/src/pages/Dashboard.tsx` | Added runtime info bar |
| `ui/src/pages/CompanySettings.tsx` | Added lifecycle guard |

---

## 7. Productization Verdict

### Is the system meaningfully closer to a production-ready product?

**YES.** Specifically:

1. **A new user can understand the onboarding choices without reading code.** The mode chooser presents two clear options with descriptions.

2. **A user with an existing OpenClaw can attach it through a guided flow.** The attach wizard walks through connection → discovery → review → confirmation with clear status indicators at each step.

3. **A user can create a new team from Paperclip with clear progress and outcomes.** The existing cold-start flow is unchanged and accessible from the mode chooser.

4. **The dashboard accurately reflects the current team/runtime state.** Runtime info bar shows gateway, workspace, and mode. Non-active companies show status banners.

5. **Lifecycle states are truthful.** Attached companies go directly to "active" (no fake provisioning). Cold-started companies go through the full pipeline. The UI never blurs these concepts.

### What is NOT yet production-ready?

- **Docker orchestration**: No auto-provisioning of isolated runtime containers per team
- **Multi-team isolation validation**: No runtime-level isolation checks between teams sharing a gateway
- **AI-assisted workspace discovery**: Discovery is deterministic filesystem scanning only
- **Transaction safety**: confirmAttach is not wrapped in a DB transaction
- **Authenticated deployment hardening**: Path traversal protection for non-local deployments

### Recommendation

The attach-existing-OpenClaw flow is a first-class, truthful feature. The cold-start flow is unchanged and stable. The mode chooser, dashboard enhancements, and lifecycle guards make the product materially more intuitive.

The known debt items are documented, none are silent failures, and all have clear remediation paths. The system is ready for user testing and feedback.
