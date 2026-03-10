# Claude Code Agent Orchestration Fix Plan

## Mission

You are Claude Code acting as the lead technical program manager and principal engineer for the `paperclip` codebase. You must spin up a coordinated team of highly specialized implementation agents and drive them in a strict sequence to finish the OpenClaw-first bootstrap rework correctly.

This is not a greenfield build anymore.

A previous implementation pass already completed meaningful scaffolding, but it did **not** fully satisfy the required architecture. Your job is to finish the work, correct architectural sequencing mistakes, harden the runtime path, and validate the final behavior under pressure.

You must manage the team as a disciplined multi-agent engineering program with explicit phases:

- design and gap analysis
- implementation
- code review
- adversarial pressure testing
- test execution and regression validation
- final integration signoff

Do not let agents work as an unstructured swarm. Assign precise scopes, enforce handoffs, and require review gates.

---

# 1. Current Reality

## 1.1 What already exists

The prior implementation has already added real foundations, including:

- `provisioning_jobs` table and migration
- provisioning shared types and validators
- OpenClaw baseline template files
- workspace initializer service
- instance readiness service
- provisioning service and routes
- generation worker service
- simplified `BootstrapWizard` UI
- `ProvisioningProgress` UI
- lifecycle-aware updates in routing/company navigation/dashboard
- documentation file: `docs/OPENCLAW_BOOTSTRAP_ARCHITECTURE.md`

This work is useful and should not be discarded casually.

## 1.2 What is still wrong

The prior implementation is **not complete** and has important architectural flaws.

The most important gaps that must be fixed are:

### Gap A: generation happens after activation

The provisioning pipeline currently marks the company `active` and marks the provisioning job `completed` before the Claude generation worker is actually finished.

This is incorrect.

Generation must be a real in-pipeline phase, not a post-completion side effect.

### Gap B: Docker/OpenClaw cold-start orchestration is not truly implemented

The current implementation checks readiness and workspace state, but it does not yet fully implement a deterministic cold-start runtime bring-up path that actually manages Docker/OpenClaw lifecycle the way the target architecture requires.

### Gap C: lifecycle semantics are still only partially hardened

Provisioning and failed companies are partially surfaced in the UI, but the system still needs stronger lifecycle-consistent behavior across:

- redirects
- company selection
- dashboard behavior
- settings behavior
- provisioning recovery paths

### Gap D: tests do not yet prove the critical guarantees

Existing tests are useful but insufficient. They do not yet prove:

- generation before activation
- activation only after verified readiness
- end-to-end provisioning sequence integrity
- retry correctness
- lifecycle-aware routing consistency
- cold-start runtime behavior under stress

---

# 2. End State Required

The final system must satisfy all of the following:

- OpenClaw is the canonical runtime path in the main bootstrap flow
- company creation runs through a tracked provisioning pipeline
- generation is an actual provisioning phase before activation
- activation occurs only after readiness + generation success criteria are met
- Docker/OpenClaw bring-up is deterministic enough to support the cold-start promise, or the implementation clearly and honestly narrows the promise in code and UX
- lifecycle state is authoritative across backend and frontend
- provisioning failures are visible, recoverable, and retryable
- the final result is materially harder to break than the current state

---

# 3. Required Specialist Agents

You must spin up the following agents. Keep the scopes clean. Do not merge these roles into one generic agent unless absolutely necessary.

## Agent 1: Principal Architect / Program Orchestrator

### Responsibilities

- own the whole program
- read all implementation artifacts before edits begin
- write the execution plan
- sequence the other agents
- resolve conflicts between agents
- enforce architectural invariants
- decide whether partial implementations are acceptable or must be redone

### Non-negotiable duties

- must produce the initial execution plan before code changes expand further
- must define the integration gates between agents
- must reject any patch that preserves the incorrect generation/activation order

## Agent 2: Backend Lifecycle Engineer

### Responsibilities

- own lifecycle semantics
- own provisioning job state transitions
- own company status transitions
- own retry/failure semantics
- own any server-side API or persistence changes required for correctness

### Focus areas

- `server/src/services/provisioning.ts`
- `server/src/routes/provisioning.ts`
- DB status fields / provisioning persistence
- any related shared types and validators

### Must fix

- generation must become a true provisioning phase
- activation must happen only after generation reaches success criteria
- job completion must mean the full pipeline is done
- retry semantics must be phase-aware and correct

## Agent 3: Runtime Provisioning / Docker Integration Engineer

### Responsibilities

- own deterministic runtime bring-up
- own OpenClaw connectivity assumptions
- own any docker-compose or runtime orchestration logic required for the cold-start claim
- own health checks and runtime readiness semantics

### Focus areas

- docker files and compose files
- runtime boot scripts or orchestration helpers
- OpenClaw gateway expectations
- host/container path consistency

### Must decide and implement

Either:

- implement a true deterministic Docker/OpenClaw bring-up path

or:

- explicitly narrow the product promise in code and docs so the system does not falsely claim full cold-start orchestration when it is really doing runtime attachment

No ambiguous middle state is allowed.

## Agent 4: OpenClaw Workspace Contract Engineer

### Responsibilities

- own the baseline template and file contract
- own workspace initialization behavior
- own validation of expected files/folders
- own manifest/binding correctness between workspace and Paperclip

### Focus areas

- `server/src/openclaw-baseline/`
- `server/src/services/workspace-initializer.ts`
- workspace verification logic
- instance/workspace binding contracts

### Must verify

- baseline files are sufficient and coherent
- validation covers the real contract
- agent config and workspace folder structure are internally consistent

## Agent 5: Claude Generation Pipeline Engineer

### Responsibilities

- own the generation worker
- own Anthropic integration
- own content-generation job semantics
- own progress reporting and failure handling for generation

### Focus areas

- `server/src/services/generation-worker.ts`
- generation-related portions of provisioning orchestration
- persistence/logging of generation progress

### Must fix

- generation can no longer be a post-completion background side effect
- generation progress must be reflected in job status/logs
- generation failure policy must be explicit
- generation outputs must be validated before activation if they are part of readiness criteria

## Agent 6: Frontend Lifecycle / UX Engineer

### Responsibilities

- own lifecycle-aware UI behavior
- own provisioning UX
- own routing consistency
- own company selector/dashboard/settings behavior for draft/provisioning/failed/active/archived companies

### Focus areas

- `ui/src/App.tsx`
- `ui/src/context/CompanyContext.tsx`
- `ui/src/components/CompanySwitcher.tsx`
- `ui/src/pages/BootstrapWizard.tsx`
- `ui/src/pages/ProvisioningProgress.tsx`
- `ui/src/pages/Dashboard.tsx`
- any settings pages that need lifecycle handling

### Must verify

- users cannot be misled by inconsistent state
- provisioning companies do not behave like fully active companies unless explicitly intended and safely handled
- failed companies surface recovery affordances
- success paths land in the right destination after activation

## Agent 7: Code Review / Static Analysis Engineer

### Responsibilities

- review all changed code after implementation agents finish each wave
- search for architectural inconsistencies
- inspect cross-file assumptions
- identify dead logic, race conditions, or hidden regressions

### Required posture

This agent is not a cheerleader. It must behave like a strict reviewer.

It must explicitly answer:

- what assumptions does this code make?
- what breaks if the OpenClaw gateway is absent?
- what breaks if generation fails halfway?
- what breaks if provisioning retries after partial success?
- where can lifecycle state become inconsistent?

## Agent 8: Adversarial Pressure-Test Engineer

### Responsibilities

- act like a chaos tester
- try to break the new design with realistic failure scenarios
- inspect code and simulate hostile conditions mentally and through tests

### Required scenarios

At minimum, pressure test these cases:

- gateway unavailable at provisioning start
- workspace root missing or not writable
- baseline template incomplete
- Anthropic key missing
- generation partially writes files then fails
- retry after a failed generation phase
- duplicate provisioning attempts for same company
- navigation to provisioning company routes during incomplete setup
- archived/failed/provisioning company appearing in inconsistent UI surfaces

This agent must produce a failure matrix and identify whether the code handles each case safely.

## Agent 9: QA / Test Automation Engineer

### Responsibilities

- create and run tests
- extend regression coverage
- validate lifecycle invariants through automated tests where possible
- define manual verification steps for anything not easily automated

### Must add coverage for

- provisioning phase sequencing
- generation-before-activation guarantee
- retry behavior
- lifecycle-aware routing/selection
- status transitions for company and job models
- any runtime-readiness logic that can be realistically tested

## Agent 10: Final Integration Judge

### Responsibilities

- review the completed work after all prior agents finish
- compare final state against this instruction document
- reject completion if the architecture still lies about readiness or completion
- produce final signoff only if all success criteria are genuinely met

This agent must be the final gate.

---

# 4. Required Sequence of Work

You must execute the specialists in the following sequence.

Do not skip the review and pressure-testing phases.

## Phase 1: Architecture and gap confirmation

### Agents involved

- Agent 1: Principal Architect / Program Orchestrator
- Agent 7: Code Review / Static Analysis Engineer
- Agent 8: Adversarial Pressure-Test Engineer

### Required output

Before major edits, these agents must produce a concise internal plan that states:

- exactly what the current implementation already does
- exactly where it violates the intended architecture
- what the minimal correct fix sequence is
- what can be reused unchanged
- what must be rewritten

This phase must explicitly call out the generation/activation ordering bug.

## Phase 2: Backend sequencing correction

### Agents involved

- Agent 2: Backend Lifecycle Engineer
- Agent 5: Claude Generation Pipeline Engineer
- Agent 4: OpenClaw Workspace Contract Engineer

### Required outcome

These agents must correct the provisioning pipeline so that:

- generation is a true provisioning phase
- generation progress is persisted or surfaced via job state/logging
- activation only occurs after generation success criteria are met
- job completion means the whole pipeline is complete
- failure and retry semantics are coherent

### Required review gate

- Agent 7 must review this work before Phase 3 starts

## Phase 3: Runtime bring-up truthfulness and Docker/OpenClaw hardening

### Agents involved

- Agent 3: Runtime Provisioning / Docker Integration Engineer
- Agent 2: Backend Lifecycle Engineer
- Agent 4: OpenClaw Workspace Contract Engineer

### Required outcome

This phase must resolve the cold-start/runtime truth problem.

You must choose one of two acceptable outcomes:

### Acceptable Outcome A

Implement a real deterministic Docker/OpenClaw bring-up path that supports the product promise.

### Acceptable Outcome B

If that full bring-up cannot be implemented safely in this pass, then:

- explicitly narrow the promise in code, docs, and UX
- rename readiness/provisioning semantics where needed
- ensure the system no longer falsely claims it is fully booting OpenClaw from cold start when it is really attaching to an existing runtime

This decision must be explicit.

### Required review gate

- Agent 7 must review the chosen approach
- Agent 8 must pressure-test the chosen approach

## Phase 4: Frontend lifecycle hardening

### Agents involved

- Agent 6: Frontend Lifecycle / UX Engineer
- Agent 2: Backend Lifecycle Engineer

### Required outcome

Ensure frontend behavior matches lifecycle truth everywhere.

This includes:

- routing
- root redirects
- dashboard behavior
- company switcher behavior
- settings behavior
- provisioning progress behavior
- success/failure navigation

### Required review gate

- Agent 7 reviews
- Agent 8 pressure-tests navigation and state consistency

## Phase 5: Testing and regression build-out

### Agents involved

- Agent 9: QA / Test Automation Engineer
- Agent 8: Adversarial Pressure-Test Engineer
- Agent 7: Code Review / Static Analysis Engineer

### Required outcome

Add meaningful automated and manual validation covering the actual risks.

Do not stop at unit tests for constants and validators.

The tests must demonstrate the intended guarantees.

## Phase 6: Final integration and signoff

### Agents involved

- Agent 10: Final Integration Judge
- Agent 1: Principal Architect / Program Orchestrator

### Required output

The final signoff must explicitly answer:

- Did we fix generation-before-activation?
- Is the provisioning job truthfully complete only after the full workflow is done?
- Does the runtime story honestly match the implementation?
- Are lifecycle states honored consistently across backend and frontend?
- What remains as known debt, if anything?

---

# 5. Rules For How Agents Must Work Together

## 5.1 No silent architectural drift

If an implementation agent discovers that the required architecture cannot be completed exactly as planned, it must escalate that clearly. It must not quietly weaken the architecture while preserving the appearance of completion.

## 5.2 Review happens after each wave

After each major implementation wave:

- Agent 7 must perform code review
- Agent 8 must perform pressure testing
- only then may the next wave proceed

## 5.3 Pressure testing is mandatory, not optional

You must actively try to break the system after implementation waves. Do not treat tests as a rubber stamp.

## 5.4 Testing must include state and sequence

The critical part of this project is not only data shape. It is sequence integrity.

Tests must validate ordering and state transitions.

## 5.5 Do not declare victory on scaffolding alone

Scaffolding is not completion.

UI pages, routes, and new types do not count as full delivery unless the runtime behavior and lifecycle semantics are actually correct.

---

# 6. Exact Fixes That Must Be Addressed

The following items must be explicitly handled.

## Fix 1: Make generation a real pipeline phase

The generation worker must be integrated into the real provisioning pipeline.

It must no longer run only after the job is already completed.

The provisioning job’s phase, progress, logging, and completion semantics must truthfully include generation.

## Fix 2: Activation must happen after generation success criteria

A company must not become `active` until the pipeline’s generation phase has reached the defined success checkpoint.

If degraded generation is allowed, that rule must be made explicit and implemented intentionally.

## Fix 3: Retry semantics must be coherent

Retry must correctly handle partial progress and partial artifacts.

Define what happens when retry starts after failure in:

- workspace initialization
- runtime attach
- workspace verify
- generation
- activation

## Fix 4: Cold-start runtime claim must be made truthful

Either implement true Docker/OpenClaw bring-up or narrow the promise. Do not leave this ambiguous.

## Fix 5: Frontend lifecycle consistency must be hardened

The following surfaces must behave consistently:

- company selection
- root redirect
- dashboard
- provisioning progress screen
- company settings
- archived handling
- failed handling
- provisioning handling

## Fix 6: Tests must prove the important guarantees

At minimum, tests or clearly documented verification must prove:

- generation-before-activation
- activation-after-readiness
- truthful job completion semantics
- correct retry behavior
- lifecycle-consistent UI/routing behavior

---

# 7. Pressure-Test Matrix

The Adversarial Pressure-Test Engineer must evaluate at minimum:

- provisioning start with missing workspace root
- provisioning start with unwritable workspace root
- missing baseline template files
- gateway health failures
- gateway partially reachable but not fully healthy
- Anthropic key missing
- Anthropic API failure or rate limit
- partially written generation output
- generation succeeds for one role and fails for another
- retry after failed generation
- user refresh during provisioning
- user navigates directly to dashboard for provisioning company
- user navigates directly to settings for failed company
- multiple rapid provisioning attempts for the same company
- stale selected company in local storage during lifecycle transitions

For each scenario, determine:

- expected behavior
- actual behavior after changes
- whether recovery is possible
- whether user-facing state is truthful

---

# 8. Required Deliverables

The full agent team must produce:

- code changes that close the remaining architecture gaps
- updated tests
- updated docs describing the truthful final behavior
- a concise final verification report

The final verification report must include:

- what was fixed
- what was pressure-tested
- what passed
- what still remains as debt, if any

---

# 9. Definition of Done

You are done only if all of the following are true:

- generation is truly in-pipeline and no longer post-completion
- a provisioning job marked `completed` actually means the full provisioning workflow is complete
- a company marked `active` is truly ready by the defined success criteria
- the cold-start/runtime story is truthful and implemented or explicitly narrowed
- lifecycle semantics are consistent across backend and frontend
- retry behavior is coherent and tested
- failure states are visible and recoverable
- the system has been code-reviewed, pressure-tested, and validated

---

# 10. First Command To Claude Code

Begin by instantiating the agents listed in Section 3 and execute Phase 1 exactly as written.

Do not start coding immediately.

First produce a concise gap confirmation memo and execution order that explicitly identifies:

- what the previous implementation completed
- what remains broken
- which agent owns each fix
- what the review gates are

Then proceed through the phases in order, with review and pressure-testing after each major implementation wave.
