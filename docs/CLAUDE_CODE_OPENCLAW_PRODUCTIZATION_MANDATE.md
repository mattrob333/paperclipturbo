# Claude Code OpenClaw Productization Mandate

## Mission

You are Claude Code acting as the lead architect, principal engineer, systems integrator, product designer, QA lead, and release hardening coordinator for the `paperclip` project.

Your job is to move Paperclip materially closer to a production product.

You must build on the current implementation and drive it toward a coherent product with:

- an intuitive onboarding flow
- an intuitive dashboard and lifecycle model
- a truthful and reliable OpenClaw integration story
- support for attaching an existing OpenClaw environment
- support for cold-starting one or more isolated teams
- stronger provisioning correctness
- stronger runtime verification
- stronger tests and operational confidence

This is not a vague ideation exercise. You are expected to write code, review code, double-check code, test code, and verify the product experience and systems behavior.

You must use specialized agents with clear scopes and review gates.

---

# 1. Product Direction

Paperclip should support two primary provisioning modes.

## Mode A: Attach Existing OpenClaw

A user already has an OpenClaw environment running.

Paperclip should provide a way to:

- connect to that environment
- discover or ingest enough configuration to understand its workspace/runtime shape
- map OpenClaw runtime settings into Paperclip company/team configuration
- attach agents and workspaces to the Paperclip UI in a truthful way
- surface the resulting team/company in a clean onboarding flow

This mode should be optimized for users who already have OpenClaw and want Paperclip to become the management/orchestration layer on top of it.

## Mode B: Cold-Start New Team

A user wants Paperclip to create a new team from scratch.

Paperclip should provide a way to:

- create a new company/team
- initialize the workspace from the OpenClaw baseline
- generate the required role and identity files
- connect the team to an OpenClaw runtime
- optionally run the team in its own isolated Docker runtime/container arrangement
- support creating a second team, third team, and more, without collapsing them together unintentionally

This mode should be optimized for clean setup, isolation, repeatability, and clarity.

---

# 2. Current State You Are Inheriting

A prior implementation pass already added useful scaffolding, including:

- provisioning job persistence
- provisioning lifecycle phases
- readiness checks
- workspace initializer
- generation worker
- provisioning UI and progress UI
- improved lifecycle routing
- generation-before-activation fix in the provisioning pipeline
- deeper provisioning tests

This means you are **not** starting from zero.

However, the current system is still incomplete relative to the product we want.

---

# 3. Key Product Gaps To Close

You must explicitly address the following product and architecture gaps.

## Gap 1: Attach-existing-OpenClaw is not a first-class onboarding flow yet

The system can provision a new company, but it does not yet provide a mature attach/import flow for a user who already has OpenClaw running elsewhere.

We need a real attach story.

## Gap 2: Cold-start multi-team isolation is not fully productized

The current provisioning flow is still closer to:

- initialize a workspace
- attach to a runtime

than to:

- create and manage multiple isolated teams with clear runtime boundaries

We need a better story for second/third teams, isolated runtime wiring, and operational clarity.

## Gap 3: Runtime truth is still under-specified

The product must clearly distinguish between:

- attaching to an existing runtime
- provisioning a new runtime
- verifying runtime health
- mapping a runtime to one or more teams

The UI, docs, and backend should not blur these concepts.

## Gap 4: Onboarding and dashboard UX still need product hardening

The user should understand:

- what mode they are in
- whether they are attaching or creating
- what infrastructure is required
- what the current provisioning status means
- what action to take when something fails
- what team/runtime they are currently managing

## Gap 5: The system needs a stronger production-readiness path

We need better:

- diagnostics
- failure handling
- lifecycle consistency
- runtime discovery/attachment semantics
- tests for the new attach/cold-start flows
- operator confidence

---

# 4. Product Goals

Claude Code must move the system toward the following product goals.

## Goal A: A user can spin up this project and attach an existing OpenClaw

A user who already has OpenClaw should be able to:

- launch Paperclip
- choose an onboarding option like `Attach Existing OpenClaw`
- provide or discover the gateway/workspace/runtime details
- validate that the runtime is reachable and compatible
- import or map the team/workspace settings into Paperclip
- see the attached team reflected correctly in the dashboard and company/team UI

## Goal B: A user can cold-start a new team

A user should be able to:

- create a new company/team from Paperclip
- provision the workspace and runtime path correctly
- wait through a clear progress UI
- end up with a functioning team in the Paperclip UI

## Goal C: A user can cold-start multiple isolated teams

A user should be able to:

- create team 1
- create team 2
- create team 3
- choose whether those teams share an existing runtime or get isolated runtime/container boundaries
- avoid confusing cross-team leakage in workspace or runtime settings

## Goal D: Onboarding should be intuitive and confidence-building

The onboarding flow should clearly explain:

- attach vs create
- what information is required
- what Paperclip will do
- what OpenClaw resources are being used
- what success/failure means

## Goal E: Dashboard and lifecycle UX should feel production-worthy

The dashboard and surrounding navigation should accurately reflect:

- team/company state
- provisioning state
- failure state
- attached-runtime state
- multi-team context

---

# 5. Required Specialized Agents

You must spin up the following specialist agents and keep their scopes explicit.

## Agent 1: Product Architect / Program Orchestrator

### Owns

- overall plan
- phase sequencing
- integration decisions
- success criteria enforcement
- final architecture coherence

### Must do first

- inventory current implementation
- decide which parts can be reused
- publish a phase plan before invasive edits

## Agent 2: OpenClaw Attach Flow Engineer

### Owns

- attach-existing-OpenClaw backend flow
- runtime discovery/validation APIs
- mapping imported settings into Paperclip entities
- import/attach semantics for workspaces and agents

### Key questions to answer

- what minimum information is required to attach?
- can we discover agent folders/config files from an existing workspace?
- how do we reconcile imported OpenClaw config with Paperclip company records?
- what is the safe contract for attach mode?

## Agent 3: Runtime Isolation / Docker Provisioning Engineer

### Owns

- cold-start runtime strategy
- multi-team runtime isolation strategy
- Docker/container orchestration model
- compose/env/runtime mapping
- truthfulness of the runtime model

### Must decide and implement

A clear model for:

- shared existing runtime attachment
- isolated per-team runtime option
- naming/networking/volume strategy
- how second and third teams are created safely

## Agent 4: Provisioning Lifecycle Engineer

### Owns

- provisioning job model
- lifecycle transitions
- retry semantics
- attach mode and cold-start mode orchestration
- state consistency between company, job, runtime, and UI

### Must verify

- lifecycle states remain truthful in both modes
- attach workflows and cold-start workflows use appropriate state transitions
- retry/failure paths are correct

## Agent 5: Workspace Discovery / Contract Engineer

### Owns

- baseline workspace contract
- import/discovery of existing workspace structures
- OpenClaw config parsing
- mapping discovered files/folders/agent roles into Paperclip concepts

### Strong preference

If a Claude/Agent SDK-assisted discovery path is useful, use it carefully and explicitly. Do not hand-wave with AI magic. Define exactly what is deterministic, what is inferred, and what must be confirmed by the user.

## Agent 6: Generation / Bootstrap Content Engineer

### Owns

- generation worker behavior
- content generation for cold-started teams
- validation of generated outputs before activation
- generation observability and failure policy

## Agent 7: Frontend Onboarding / Product UX Engineer

### Owns

- onboarding mode selection UX
- attach-existing flow UX
- cold-start flow UX
- provisioning progress UI
- dashboard context and status presentation
- runtime/team selection clarity

### UX goals

The user should always know:

- what they are doing
- what environment they are attaching to or creating
- what team they are viewing
- what to do next

## Agent 8: Dashboard / Lifecycle Experience Engineer

### Owns

- dashboard state clarity
- company/team switcher behavior
- settings guardrails
- lifecycle-aware redirects
- attached-runtime representation
- failure and recovery affordances

## Agent 9: Code Review / Static Analysis Engineer

### Owns

- strict review after each implementation wave
- cross-file consistency checks
- race condition review
- schema/API/UI contract review

## Agent 10: Adversarial Pressure-Test Engineer

### Owns

- failure scenario analysis
- attach-mode chaos cases
- cold-start chaos cases
- multi-team isolation validation
- UX truthfulness under failure

## Agent 11: QA / Integration Test Engineer

### Owns

- automated tests
- integration tests
- manual verification scripts/checklists
- regression coverage for both modes

## Agent 12: Final Productization Judge

### Owns

- final acceptance evaluation
- confirming the system is closer to a production product
- rejecting incomplete work that only improves scaffolding without delivering product value

---

# 6. Work Sequence

These agents must work in sequence with review gates.

## Phase 1: Reality check and architecture memo

### Agents

- Agent 1
- Agent 9
- Agent 10

### Required output

Produce a memo that answers:

- what is already implemented well?
- what does attach-existing-OpenClaw currently lack?
- what does cold-start multi-team currently lack?
- what runtime model is currently implied by the code?
- what must be changed in backend, Docker/runtime, UI, and tests?

No major coding begins before this memo exists.

## Phase 2: Attach-existing-OpenClaw design and implementation

### Agents

- Agent 2
- Agent 5
- Agent 4
- Agent 7

### Deliverables

Implement a first-class attach flow that includes as much of the following as can be done safely and truthfully:

- onboarding entry point for `Attach Existing OpenClaw`
- backend validation of provided gateway/workspace/runtime info
- discovery/import of workspace or agent config where possible
- company/team creation or mapping for attached environments
- UI for reviewing discovered settings before finalizing attachment
- lifecycle and status handling for attached teams

### Critical rule

If discovery is incomplete or partially inferred, the UI must show that clearly and require confirmation where appropriate.

## Phase 3: Cold-start isolated team design and implementation

### Agents

- Agent 3
- Agent 4
- Agent 5
- Agent 6
- Agent 7

### Deliverables

Strengthen the cold-start flow so it can support:

- new team creation from Paperclip
- isolated runtime/container strategy where intended
- clean workspace/runtime binding
- support for second and third teams without configuration leakage
- clear provisioning progress and recovery behavior

## Phase 4: Dashboard and lifecycle product hardening

### Agents

- Agent 7
- Agent 8
- Agent 4

### Deliverables

Make the UI feel like a product rather than a collection of routes.

This includes:

- onboarding mode clarity
- runtime/team context clarity
- lifecycle-consistent redirects
- better failure/recovery affordances
- settings/dashboard guardrails for non-active teams
- clearer multi-team management model

## Phase 5: Review, pressure test, and close correctness gaps

### Agents

- Agent 9
- Agent 10
- Agent 11

### Deliverables

Review all work and try to break it.

Must test:

- attach flow success
- attach flow partial discovery
- attach flow invalid runtime
- cold-start success
- cold-start failure
- second/third team provisioning
- runtime isolation edge cases
- retry and recovery
- stale selection and redirect edge cases

## Phase 6: Final acceptance and polish pass

### Agents

- Agent 12
- Agent 1

### Deliverables

A final acceptance report that states:

- what product improvements were delivered
- what system behaviors are now supported
- what remains as known debt
- whether the result is meaningfully closer to production readiness

---

# 7. Required Design Decisions

Claude Code must make explicit decisions about the following.

## Decision 1: Attach contract

Define the canonical attach contract.

At minimum specify:

- required gateway URL
- required workspace root or team workspace path
- whether agent config files are required
- what can be discovered automatically
- what must be supplied manually
- what validation is performed before attach completes

## Decision 2: Discovery model

Define how Paperclip discovers settings from an existing OpenClaw environment.

Possible sources may include:

- config files in workspace
- runtime health endpoints
- agent manifest files
- explicit user-provided paths
- optional Claude/Agent SDK-assisted summarization or mapping

If AI-assisted discovery is used:

- define exactly what it is allowed to infer
- do not use it for hidden side effects
- require deterministic confirmation for critical configuration

## Decision 3: Multi-team runtime isolation model

Define whether teams can:

- share one OpenClaw runtime
- run in separate isolated runtime/container groups
- choose between those options during onboarding

This must be reflected in code, UI, and docs.

## Decision 4: Product truthfulness

The UI and docs must describe the runtime behavior truthfully.

If Paperclip attaches to an existing runtime, say that.
If Paperclip provisions an isolated runtime, say that.
If some combinations are not yet supported, say that.

---

# 8. Metrics of Success

Success is not "the code compiles." Success must be product-facing and system-facing.

## Product success metrics

- a new user can understand the onboarding choices without reading code
- a user with an existing OpenClaw can attach it through a guided flow
- a user can create a new team from Paperclip with clear progress and outcomes
- a user can manage multiple teams without confusion
- the dashboard accurately reflects the current team/runtime state

## Architecture success metrics

- provisioning states are truthful
- attach and cold-start modes use coherent lifecycle models
- runtime configuration is explicit and inspectable
- team/workspace/runtime relationships are not ambiguous
- retries and failures do not silently corrupt state

## Quality success metrics

- all relevant packages compile
- meaningful automated tests cover attach and cold-start flows
- adversarial tests cover failure cases and isolation risks
- docs accurately describe actual behavior

## Productization success metrics

- the system is easier to spin up
- the system is clearer to operate
- the system is safer to recover when things fail
- the onboarding and dashboard feel materially closer to a production product

---

# 9. Required Task Checklist

Claude Code must track and check off the following tasks.

## Track A: Attach Existing OpenClaw

- define attach contract
- build attach onboarding entry point
- implement backend validation for attach inputs
- implement workspace/runtime discovery where possible
- map discovered config into Paperclip entities
- show review/confirmation UI before final attach
- verify attached team appears correctly in dashboard and navigation

## Track B: Cold-Start New Team

- clarify current cold-start architecture
- implement or refine isolated runtime/team model
- support provisioning of second and third teams
- ensure workspace/runtime bindings remain isolated and understandable
- ensure lifecycle states and retry paths are coherent

## Track C: UX and Product Clarity

- add onboarding mode chooser
- improve provisioning/attach progress and error messages
- improve dashboard/runtime/team context clarity
- add lifecycle guardrails in settings and redirects
- reduce confusing state transitions

## Track D: Reliability and Testing

- add integration coverage for attach flow
- add integration coverage for cold-start flow
- add tests for multi-team isolation behavior
- add tests for retry/failure/recovery
- add manual verification steps for any runtime-heavy flows not fully automatable

## Track E: Docs and Operator Readiness

- document attach mode
- document cold-start mode
- document limitations and unsupported combinations
- document recovery procedures

---

# 10. Non-Negotiable Rules

## Rule 1

Do not pretend discovery exists if it does not.

## Rule 2

Do not claim Paperclip provisions isolated runtimes unless the implementation truly supports that mode.

## Rule 3

Do not let AI-driven discovery silently mutate critical configuration without explicit user confirmation.

## Rule 4

Do not ship UX that hides whether the user is attaching an existing environment or creating a new one.

## Rule 5

Do not declare success just because tests pass if the product story is still unclear or misleading.

---

# 11. Definition of Done

You are done only if all of the following are true:

- attach-existing-OpenClaw is a first-class, truthful flow or is explicitly scoped down with documented limitations
- cold-start team creation is more robust and supports a clear path toward multi-team isolation
- the product clearly distinguishes attach mode from cold-start mode
- onboarding is clearer and more intuitive
- dashboard/runtime/team state is easier to understand
- lifecycle and provisioning behavior remain truthful and tested
- the system is meaningfully closer to a production-ready product
- the final report names any remaining debt explicitly

---

# 12. First Command To Claude Code

Begin by instantiating the specialist agents in Section 5.

Start with Phase 1 only.

Produce a concise architecture memo that states:

- what the current implementation already supports
- what is missing for attach-existing-OpenClaw
- what is missing for cold-start isolated multi-team support
- what the likely implementation order should be
- what each agent owns
- what review and testing gates will be used

After that, proceed through the phases in order, with code review, pressure testing, and test verification after each major implementation wave.
