# Claude Code OpenClaw Production Hardening Mandate

## Mission

You are Claude Code acting as the lead production hardening engineer for the OpenClaw-enabled onboarding and team management experience in `paperclip`.

A meaningful amount of work is already complete and must be preserved:

- attach-existing-OpenClaw exists
- cold-start onboarding exists
- onboarding mode selection exists
- provisioning lifecycle and progress tracking exist
- provisioning mode and runtime mode are now persisted
- key attach/provisioning write paths are more transaction-safe than before
- dashboard and settings surface runtime/provisioning context more explicitly
- targeted hardening tests now exist

Your job now is not to re-audit the project.
Your job is to **finish the next production-grade implementation phase** so the codebase is operationally cleaner, easier to demo, and significantly closer to a trustworthy production state.

This mandate is for implementation, cleanup, hardening, validation, and truthful narrowing of product claims where necessary.

---

# 1. Current State You Must Respect

## What is already real

The repository already supports:

- `Attach Existing OpenClaw` onboarding via workspace discovery + confirm
- `Create New Team` onboarding via cold-start bootstrap flow
- lifecycle redirects for `draft`, `provisioning`, `failed`, and `active`
- persisted provisioning jobs
- persisted `provisioningMode` and `runtimeMode`
- per-company gateway URL and workspace path display
- transaction wrapping in important attach/provisioning write clusters
- uniqueness constraints for company names and agent names-within-company

## What is still not fully production-grade

The repository is still missing or under-proves several things:

- full repo verification has not been re-established from the current state
- startup/demo instructions are not yet tight enough for a clean handoff
- compose/docker setup has been improved but is still not a polished operator story
- attach/provisioning truthfulness is improved but not fully end-to-end certified
- authenticated deployment hardening is still incomplete for path-based discovery
- runtime labels exist, but runtime orchestration/isolation is still not operationalized
- stale productization/completion documentation can still mislead readers about what is truly finished

Your mission is to close the highest-value remaining gaps without destabilizing working flows.

---

# 2. Primary Goals For This Phase

At the end of this mandate, Paperclip should be materially closer to a production-ready demo and operator-ready local deployment.

Specifically:

- a fresh operator should be able to start the app more reliably
- attach and bootstrap flows should be more robust and less ambiguous
- demo-critical flows should be verified, not merely assumed
- docs should better match reality
- the codebase should contain fewer misleading claims and fewer machine-specific assumptions
- remaining known debt should be narrowed, documented clearly, or converted into actionable follow-up items

---

# 3. Non-Goals

Do **not** turn this phase into an uncontrolled rewrite.

Do **not**:

- redesign the entire app shell
- invent an unverified runtime orchestration system if the repo is not ready for it
- introduce large new infrastructure dependencies without strong justification
- break current onboarding behavior in the name of “architecture purity”
- claim dedicated-runtime/container orchestration is supported unless it actually is

If something cannot be safely completed in this phase, narrow the product promise truthfully and improve the code/docs around the current supported model.

---

# 4. Required Specialist Agents

You must use the following specialist agents with clean ownership and review gates.

## Agent 1: Principal Finisher / Program Orchestrator

### Owns

- execution plan
- scope discipline
- sequencing
- risk management
- final acceptance decision

### Must do first

- inventory current implementation versus the goals in this mandate
- publish a short execution plan before broad edits begin
- identify the highest-confidence path to a demoable and more production-grade state

## Agent 2: Verification and Release Readiness Engineer

### Owns

- typecheck/test/build verification
- identifying failing packages or scripts
- restoring repo-wide confidence
- surfacing what is truly runnable today

### Must do

- run and fix `pnpm -r typecheck` where feasible
- run and fix `pnpm test:run` where feasible
- run and fix `pnpm build` where feasible
- document any remaining failures precisely with root cause and impact

## Agent 3: Onboarding / Lifecycle Hardening Engineer

### Owns

- attach flow edge cases
- bootstrap flow polish
- onboarding redirects
- lifecycle correctness
- wizard resilience and user messaging

### Must focus on

- attach input ambiguity
- refresh/re-entry behavior where practical
- lifecycle transitions that could confuse a demo
- clear UX for next-safe action on failed/provisioning companies

## Agent 4: Authenticated Deployment and Path Safety Engineer

### Owns

- path-based attach/discovery hardening
- authenticated-mode safety rules
- narrowing dangerous filesystem access assumptions
- operator-safe configuration for discovery roots

### Must focus on

- discovery endpoint exposure in authenticated mode
- validating attach/discovery paths against an allowed base directory when appropriate
- making the supported local-vs-authenticated behavior explicit in code and docs

## Agent 5: Local Deployment / Docker / Operator Experience Engineer

### Owns

- docker-compose readiness
- environment configuration clarity
- local deployment/operator docs
- reducing machine-specific setup assumptions

### Must focus on

- portable compose configuration
- `.env.example` completeness where needed
- practical startup docs for demo operators
- making local demo startup less brittle

## Agent 6: Frontend Product UX / Truthfulness Engineer

### Owns

- runtime/provisioning truth in the UI
- label clarity
- removal of stale or misleading product language
- reducing confusing states in onboarding/dashboard/settings

### Must focus on

- onboarding wording
- dashboard/settings/runtime language
- whether the app implies runtime automation it does not actually provide
- small UX hardening improvements that meaningfully help demos

## Agent 7: Docs / Product Truth Engineer

### Owns

- README and operator docs alignment
- hardening report cleanup
- accurate known-debt documentation
- reducing contradictory narrative across docs

### Must focus on

- README quickstart and development instructions
- docker docs
- final reports that overstate capability
- creating one authoritative production-hardening summary for this phase

## Agent 8: Code Review / Static Analysis Engineer

### Owns

- review of all waves
- race-condition review
- API contract review
- regression review
- “is this truly production grade?” pushback

### Must do

- challenge optimistic claims
- verify that code, tests, and docs agree
- reject hand-wavy completion language

---

# 5. Workstreams

## Workstream A: Re-establish Full Verification Confidence

You must determine the real current repo state by actually running the appropriate verification commands and fixing what is reasonably fixable in this pass.

### Required actions

- run repo-wide typecheck
- run repo-wide tests
- run repo-wide build
- fix high-confidence failures
- if some failures remain, document them precisely in the final report

### Output required

- exact commands run
- whether each passed or failed
- what was fixed to make them pass
- what still fails, if anything, with file-level specificity

## Workstream B: Demo-Critical Onboarding Hardening

The attach and bootstrap flows must feel less fragile and less confusing.

### Required investigation areas

- attach wizard refresh/re-entry behavior
- attach duplicate selection / duplicate identity ambiguity
- company lifecycle transitions into and out of failed/provisioning states
- recovery UX after a failed provisioning job
- whether success/failure screens are clear and truthful

### Acceptable implementations

- small state persistence improvements
- clearer user messaging
- safer validation
- redirect/guard improvements
- recovery affordances that reduce demo confusion

## Workstream C: Authenticated-Mode Discovery Safety

The current attach/discovery model is acceptable for local trusted use, but production-grade work requires a more explicit stance for authenticated deployments.

### Required actions

- inspect `discover` and related attach endpoints
- determine current path exposure risk in authenticated mode
- implement an allowed-root or similarly safe guard if feasible
- otherwise narrow the supported behavior explicitly in code/docs and fail safely

### Important rule

Do not leave this as an undocumented footgun.

## Workstream D: Docker / Local Operator Experience

A person preparing a demo should not have to reverse-engineer the repo.

### Required actions

- review compose files, env examples, and startup docs
- eliminate obvious machine-specific assumptions
- improve environment/config examples where missing
- ensure the operator story for local demo startup is coherent

### Focus

- startup reliability
- local compose clarity
- environment naming clarity
- avoiding false implication of automatic OpenClaw runtime orchestration

## Workstream E: Docs and Truthfulness Cleanup

The repository currently contains multiple mandate and final-report documents from earlier phases.
Some are useful historical records, but some may now overstate capability or confuse the next engineer/operator.

### Required actions

- identify docs that are stale, contradictory, or overly optimistic
- update the most user-facing/operator-facing docs first
- produce one new final hardening report for this phase
- ensure the README and setup docs match the actual supported operator story

### Do not

- delete historical docs indiscriminately
- rewrite history

Prefer:

- clarifying status
- adding explicit caveats
- making the newest document authoritative

---

# 6. Specific Issues To Address If Confirmed

These are high-priority targets. Confirm them in code before editing, but you should expect many to be real.

## Issue 1: repo-wide verification may not currently be green

Do not trust prior reports blindly.
Run verification and fix reality.

## Issue 2: authenticated-mode attach/discovery path safety is likely under-hardened

If discovery can inspect arbitrary filesystem paths in authenticated mode, that is not production-grade.
Implement guardrails or explicitly restrict supported behavior.

## Issue 3: onboarding/demo UX still has rough edges

Examples may include:

- wizard refresh losing state
- unclear retry/recovery after failed provisioning
- unclear safe-next-step for non-active companies
- inconsistent messaging between attach and bootstrap

## Issue 4: operator startup story is still too implicit

Examples may include:

- incomplete `.env.example`
- compose expectations not reflected in docs
- local OpenClaw workspace path assumptions
- mismatch between README and actual operator workflow

## Issue 5: docs may still overstate capability

Examples may include claims that make runtime relationships or production readiness sound more complete than they really are.
Make docs more accurate.

---

# 7. Acceptance Criteria

This phase is successful if most of the following become true and are proven by code and verification output.

## Verification

- repo-wide typecheck status is known
- repo-wide test status is known
- repo-wide build status is known
- high-confidence failures have been fixed where feasible

## Onboarding and lifecycle

- attach and bootstrap flows have fewer obvious demo-breaking edge cases
- lifecycle redirects and recovery paths feel coherent
- ambiguous or duplicate attach input is better handled

## Security / deployment safety

- authenticated-mode path discovery behavior is either hardened or explicitly constrained
- the supported local-vs-authenticated model is clear in code/docs

## Operator experience

- local demo startup is more portable and less machine-specific
- compose/env/docs are more coherent

## Truthfulness

- README/docs do not imply capabilities the app does not actually provide
- a new hardening report documents what was truly achieved and what still remains

---

# 8. Required Deliverables

You must produce all of the following before declaring this phase complete.

## Deliverable A: execution plan

A concise plan with workstreams, sequence, and risk notes.

## Deliverable B: implemented code changes

Actual code, tests, and doc changes required to move the repo forward.

## Deliverable C: verification evidence

The commands run, pass/fail state, and any remaining blockers.

## Deliverable D: final report

Create:

- `docs/PRODUCTION_HARDENING_FINAL_REPORT.md`

This report must include:

- what was fixed
- what was verified
- what remains unverified
- what is still not production-grade
- recommended next phase if anything major remains

---

# 9. Execution Rules

## Rule 1

Do not start with massive edits.
Start with verification and a scoped plan.

## Rule 2

When you find a problem, prefer the smallest correct fix that materially improves trustworthiness.

## Rule 3

Preserve working behavior unless a change is clearly justified.

## Rule 4

Do not label a capability as supported unless it is actually implemented and verified.

## Rule 5

If a large promised capability cannot be completed safely in this phase, narrow the promise and strengthen the current supported model instead.

---

# 10. Final Directive

Proceed like a senior engineer responsible for taking a promising but still uneven feature set and making it operationally credible.

Your task is not to impress with scope.
Your task is to leave the repo in a state that is:

- safer
- clearer
- more portable
- more verifiable
- more honest
- closer to a real production-grade demo

Do the work, prove what works, document what does not, and do not overclaim.
