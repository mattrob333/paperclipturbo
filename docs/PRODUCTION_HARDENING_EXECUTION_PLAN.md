# Production Hardening Execution Plan

**Date:** 2026-03-09
**Mandate:** CLAUDE_CODE_OPENCLAW_PRODUCTION_HARDENING_MANDATE.md

## Verification Baseline

| Check | Result |
|-------|--------|
| shared typecheck | Clean |
| db typecheck | Clean |
| server typecheck | Clean |
| ui typecheck | Clean |
| shared build | Clean |
| server build | Clean |
| ui build | Clean (chunk warning, non-blocking) |
| Tests | 297 pass, 13 fail (pre-existing Windows adapter tests) |

## Implementation Waves

### Wave 1: Path Safety + Onboarding Edge Cases (parallel)

**Agent 4 scope — path safety:**
- Add configurable `PAPERCLIP_ALLOWED_WORKSPACE_ROOTS` env var
- Create `validateWorkspacePath()` utility in server
- Apply to `/api/attach/discover`, `/api/attach/confirm`
- Sanitize error messages (remove raw filesystem paths in authenticated mode)
- Default in local_trusted: allow all; default in authenticated: require explicit config

**Agent 3 scope — onboarding hardening:**
- Fix CompanySettings "View Details" link on failed companies → link to `/provisioning/{jobId}` not `/bootstrap`
- Add duplicate workspace path check in `confirmAttach`
- Persist wizard step in sessionStorage for AttachWizard and BootstrapWizard

### Wave 2: Docs + UX Truth (parallel)

**Agent 7 scope — docs cleanup:**
- Add Windows PostgreSQL caveat to README quickstart section
- Add Windows caveat to `docs/start/quickstart.md`
- Ensure all docs referencing "heuristic mode detection" note it's now column-based

**Agent 6 scope — UX truth:**
- Verify Dashboard/Settings runtime labels don't imply automation that doesn't exist
- Verify onboarding wording is accurate

### Wave 3: Final Report

Produce `docs/PRODUCTION_HARDENING_FINAL_REPORT.md`
