# Claude Code OpenClaw Completion Mandate

## Mission

You are Claude Code acting as the lead finisher for the OpenClaw productization effort in `paperclip`.

A meaningful amount of work is already complete:

- the provisioning pipeline is materially improved
- generation now happens before activation
- an attach-existing-OpenClaw flow now exists
- onboarding mode selection now exists
- dashboard/runtime context and lifecycle guardrails have improved
- tests have expanded substantially

Your job now is not to restart the project.
Your job is to **finish the remaining high-value work** that stands between the current state and a product that is operationally trustworthy, multi-team capable, and much closer to production quality.

This mandate is specifically about closing the remaining gaps.

---

# 1. What Has Already Been Achieved

The current codebase already supports:

## Provisioning and lifecycle

- provisioning job persistence
- six-phase provisioning model
- generation before activation
- lifecycle states for draft / provisioning / active / failed / archived
- retry support
- provisioning progress UI

## Attach-existing-OpenClaw

- attach mode in onboarding
- workspace discovery from existing filesystem paths
- gateway health check
- attach confirmation flow
- creation of company + agents from discovered workspace
- dashboard runtime context for attached teams

## UX improvements

- onboarding mode chooser (`/get-started`)
- attach wizard
- cold-start bootstrap flow remains available
- improved lifecycle redirects
- company settings lifecycle guard

## Test improvements

- provisioning orchestration tests
- attach/discovery tests
- broader integration-style coverage than before

Do not discard these gains.
Build on them carefully.

---

# 2. Remaining Gaps To Finish

These are the key gaps still preventing the product from feeling complete and operationally trustworthy.

## Gap A: attach/provisioning writes are not transaction-safe

The current attach path can create:

- company
- provisioning job
- agents

without a transaction.

This means partial state is possible if the process fails midway.

The provisioning path also has similar consistency risks in multi-step operations and retries.

## Gap B: runtime isolation model is not yet explicit and productized

The code now truthfully supports:

- attach to an existing runtime
- per-company gateway configuration
- workspace-level isolation

But it does not yet clearly and completely support:

- isolated per-team runtime/container orchestration
- a formal runtime ownership model
- multi-team isolation guarantees
- a clean operator story for second and third teams

## Gap C: multi-team orchestration is not complete enough

A user should be able to understand and safely manage:

- team 1
- team 2
- team 3

with clarity about whether they are:

- sharing a runtime
- using distinct runtimes
- using distinct workspaces
- using isolated containers

That product model is still under-defined in code and UX.

## Gap D: heuristics and non-authoritative signals still exist

> **Partially resolved.** Provisioning mode detection is now column-based (migration 0029) instead of log-text heuristic. Agent uniqueness is enforced by DB constraint. See COMPLETION_FINAL_REPORT.md for details.

Examples included:

- provisioning mode detection from log text **(resolved -- now `provisioning_mode` column)**
- ineffective `onConflictDoNothing()` paths without real supporting constraints **(resolved -- `agents_company_name_uniq` constraint added)**
- possible retry races
- possible duplicate agent creation **(resolved -- DB constraint)**

These should be replaced with stronger, more explicit system truth where feasible.

## Gap E: production hardening is still incomplete

The system needs better:

- transactional guarantees
- unique constraints where correctness depends on them
- authenticated-mode safety for path-based attach discovery
- clearer recovery semantics
- validation around multi-team and runtime choices

---

# 3. Product Goal For This Mandate

At the end of this mandate, Paperclip should be much closer to a production-ready operational model.

Specifically:

- attach and cold-start flows should be safer and more truthful
- multi-team runtime behavior should be explicit and understandable
- the data model should better reflect system truth
- retries and duplicate creation paths should be harder to break
- the product should feel less like a prototype and more like a controlled system

---

# 4. Required Specialist Agents

You must use the following specialist agents. Keep ownership clean and require review gates.

## Agent 1: Principal Finisher / Program Orchestrator

### Owns

- execution plan
- scoping decisions
- sequencing of work
- acceptance gates
- avoiding regressions to already-working flows

### Must do first

- inventory current implementation and known debt
- publish a concise completion plan before large edits begin

## Agent 2: Transaction and Persistence Integrity Engineer

### Owns

- DB transaction safety
- data consistency across attach/provisioning flows
- uniqueness and conflict semantics
- schema and migration changes where required

### Must focus on

- `attachService.confirmAttach`
- provisioning activation/retry semantics
- agent creation correctness
- company uniqueness / issue prefix correctness

## Agent 3: Runtime Model / Multi-Team Architecture Engineer

### Owns

- explicit runtime ownership model
- multi-team runtime strategy
- shared-runtime vs isolated-runtime semantics
- operator-facing truth in code and docs

### Must decide and implement

A clear and explicit runtime model that answers:

- when teams share a runtime
- when teams use separate runtimes
- what Paperclip actually supports today
- how second and third teams are represented and managed

This may include code, UI language, docs, and persisted metadata.

## Agent 4: Container / Docker Integration Engineer

### Owns

- isolated runtime/container feasibility
- docker-compose/runtime wiring
- container naming, volume naming, network naming strategy
- whether Paperclip can launch isolated team runtimes or only prepare for them

### Critical rule

If full automatic isolated runtime orchestration cannot be safely implemented in this pass, you must narrow the product promise truthfully and still leave the codebase in a stronger state for that future capability.

## Agent 5: Provisioning and Attach Lifecycle Engineer

### Owns

- lifecycle state correctness across attach and cold-start modes
- retry and failure semantics
- authoritative provisioning mode truth
- removal of heuristic state where possible

### Must focus on

- explicit provisioning mode storage
- job/company/runtime relationship consistency
- retry race hardening

## Agent 6: Frontend Product UX / Team Management Engineer

### Owns

- multi-team clarity in onboarding and dashboard
- runtime mode clarity in UI
- team/runtime labeling
- lifecycle-aware UX for attach vs cold-start
- settings and management surfaces

### UX objective

A user should understand:

- which team they are looking at
- whether it is attached or provisioned
- whether it uses a shared or isolated runtime
- what actions are safe to take next

## Agent 7: Code Review / Static Analysis Engineer

### Owns

- architectural review after each wave
- race-condition review
- uniqueness/constraint review
- persistence integrity review

## Agent 8: Adversarial Systems Test Engineer

### Owns

- breaking concurrency assumptions
- breaking multi-team assumptions
- breaking attach/provisioning recovery assumptions
- evaluating authenticated-mode risks

## Agent 9: QA / Integration / Regression Engineer

### Owns

- automated test additions
- migration validation
- multi-team test coverage
- manual verification checklist for any runtime-heavy paths

## Agent 10: Final Acceptance Judge

### Owns

- final completion verdict
- checking whether the product is materially more trustworthy and closer to production
- rejecting superficial completion claims

---

# 5. Required Sequence of Work

## Phase 1: Completion architecture memo

### Agents

- Agent 1
- Agent 7
- Agent 8

### Required output

Produce a concise memo covering:

- what is already solid and should remain stable
- which known debt items are real and highest priority
- what must change in schema, services, routes, UI, and docs
- what the runtime model should be after this pass
- what the implementation order should be

No major implementation wave begins before this memo exists.

## Phase 2: Persistence and transaction hardening

### Agents

- Agent 2
- Agent 5
- Agent 7

### Required deliverables

Implement and verify:

- transaction safety for attach confirmation
- improved consistency for multi-step writes
- real uniqueness/constraint strategy where correctness depends on it
- duplicate-agent prevention strategy that actually works
- safer retry semantics where feasible

### Examples of likely targets

- wrap `confirmAttach` in a DB transaction
- add unique constraints or stronger keys for agent uniqueness if appropriate
- add company uniqueness or alternative conflict strategy if required
- remove dead conflict-handling logic that lacks DB support

## Phase 3: Runtime model truth and multi-team representation

### Agents

- Agent 3
- Agent 4
- Agent 5
- Agent 6

### Required deliverables

Define and implement a truthful model for runtime relationships.

At minimum, the system must clearly represent:

- provisioning mode: attach vs cold_start
- runtime mode: shared vs isolated vs unknown/planned
- gateway ownership/association per team/company
- workspace ownership/association per team/company

### Important rule

If full isolated container orchestration is not implemented, the product must say so clearly and still expose the runtime relationship model honestly.

## Phase 4: UX and team-management hardening

### Agents

- Agent 6
- Agent 5
- Agent 7

### Required deliverables

Improve UX so users can better manage multiple teams.

Potential outcomes include:

- clearer runtime/team metadata in dashboard and settings
- better labels and affordances in company/team switching
- clearer attach/provisioning status language
- safer management UI for non-active and partially configured teams
- better onboarding copy around shared vs isolated runtime choices

## Phase 5: Pressure testing and regression validation

### Agents

- Agent 8
- Agent 9
- Agent 7

### Required deliverables

Add tests and run adversarial checks for:

- concurrent attach requests with same company name
- partial failure during attach transaction
- duplicate agent creation attempts
- retry concurrency edge cases
- multiple teams sharing one gateway
- multiple teams with distinct gateways
- authenticated-mode path validation behavior
- runtime mode representation correctness in UI and API

## Phase 6: Final acceptance and product readiness assessment

### Agents

- Agent 10
- Agent 1

### Required output

A final report that answers:

- what was fixed
- what constraints/migrations were added
- what runtime model is now officially supported
- what multi-team behavior is now supported
- what remains as deliberate future work
- whether the product is materially closer to production quality

---

# 6. Required Design Decisions

Claude Code must explicitly decide the following.

## Decision 1: Canonical provisioning mode representation

> **RESOLVED.** A `provisioning_mode` column was added to `provisioning_jobs` (migration 0029). Log-string heuristics are no longer used.

Do not rely on log-string heuristics to infer whether a company was attached or cold-started.

Introduce a stronger source of truth if appropriate, such as:

- a persisted provisioning mode field
- a runtime association table
- an explicit metadata structure

## Decision 2: Runtime relationship model

Define the canonical relationship between:

- company/team
- workspace path
- gateway URL
- runtime mode

This must be represented explicitly enough that UI and backend do not guess from incidental fields.

## Decision 3: Agent uniqueness model

Define how the system prevents duplicate agents for the same company/workspace/runtime combination.

This should be enforced by real data-model constraints or a clearly stronger write pattern.

## Decision 4: Company identity and attach conflict model

Define what uniqueness is required for company creation in attach mode.

If `companies.name` should be unique, enforce it.
If not, define another safe conflict strategy.

## Decision 5: Isolated runtime support level

You must explicitly categorize isolated runtime support as one of:

- fully implemented
- partially implemented / operator-assisted
- not yet implemented, only represented in model/docs

Do not leave this ambiguous.

---

# 7. Success Metrics

## Integrity metrics

- attach confirmation cannot leave partial writes on ordinary failure paths
- duplicate-agent creation is materially harder or impossible through normal flows
- provisioning mode is represented by explicit system truth, not log heuristics **(done -- `provisioning_mode` column)**
- retry behavior is safer and better defined

## Multi-team metrics

- the product can represent more than one team clearly
- runtime relationships are understandable
- users can tell whether teams share or do not share runtime infrastructure
- second and third teams do not create obvious identity/runtime confusion in UI

## Product metrics

- onboarding language is clearer about attach vs cold-start vs runtime mode
- dashboard/settings show more authoritative runtime/team context
- the product feels safer and less ambiguous

## Quality metrics

- all relevant TypeScript packages compile
- new tests cover the newly hardened behaviors
- failure and concurrency scenarios are exercised
- docs match real behavior

---

# 8. Required Task Checklist

Claude Code must track and complete these tasks.

## Track A: Transaction and schema hardening

- audit current write paths for partial-state risk
- add transactions where correctness depends on them
- add migrations/constraints where appropriate
- verify uniqueness/conflict behavior under tests

## Track B: Provisioning mode and runtime truth

- replace heuristic provisioning-mode detection with explicit data truth **(done -- `provisioning_mode` column, migration 0029)**
- define runtime relationship model **(done -- `runtime_mode` column)**
- expose runtime mode truth in backend and UI **(done -- Dashboard and Settings read columns directly)**

## Track C: Multi-team clarity

- improve how multiple companies/teams are represented
- make shared vs isolated runtime semantics understandable
- improve UI labels and context where needed

## Track D: Reliability and recovery

- harden retry and duplicate creation behavior
- verify attach/provisioning recovery semantics
- document remaining edge cases honestly

## Track E: Final productization docs

- document runtime model
- document attach vs cold-start truthfully
- document multi-team support level
- document remaining future-work items

---

# 9. Non-Negotiable Rules

## Rule 1

Do not claim isolated multi-container team orchestration if it is not actually implemented.

## Rule 2

Do not rely on log-message parsing as the final source of truth for important product semantics if a better persisted model can be introduced safely.

## Rule 3

Do not leave attach confirmation non-transactional if that path is presented as a real product feature.

## Rule 4

Do not introduce broad risky schema changes without corresponding tests and migration clarity.

## Rule 5

Do not regress the already-working provisioning and attach flows while hardening the system.

---

# 10. Definition of Done

You are done only if all of the following are true:

- attach writes are transaction-safe or materially safer with clearly justified design
- provisioning mode is represented more explicitly and truthfully **(done -- column-based, not heuristic)**
- runtime/team relationships are clearer in the data model and UI
- multi-team behavior is better defined and easier to understand
- duplicate-agent and conflict semantics are materially improved
- tests cover the new integrity and multi-team concerns
- docs truthfully describe supported runtime/isolation behavior
- the product is meaningfully closer to production readiness than before this pass

---

# 11. First Command To Claude Code

Instantiate the specialist agents from Section 4 and start with Phase 1 only.

Produce the completion architecture memo first.

That memo must explicitly list:

- the most important remaining integrity risks
- the most important runtime-model ambiguities
- the highest-value schema and code changes
- which agent owns each fix
- what review and testing gates will be used

Only then proceed through the phases in order.
