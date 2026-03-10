# Claude Code Agent Mandate: Deterministic OpenClaw-First Bootstrap Rework

## Mission

You are acting as the lead orchestrator for a specialized multi-developer implementation team inside the `paperclip` codebase. Your job is to plan and execute a substantial architecture rework so Paperclip can boot companies from a cold start in a deterministic, hardened, OpenClaw-first way.

You must spin up a team of specialized developers, assign clear scopes, coordinate dependencies, and drive the work to a shippable state. Do not treat this as a small bugfix. Treat it as a product and platform re-architecture.

This document defines:

- the current state of the system
- the target state we need to reach
- the architecture constraints and invariants
- the workstreams to assign
- the success criteria that define completion

---

# 1. What We Have Today

## 1.1 Product shape today

Paperclip currently functions as the management layer in a broader system:

- `AgentOrgCompiler` = builder/compiler layer
- `OpenClaw` = runtime layer
- `Paperclip` = management/orchestration UI + server layer

Paperclip currently includes:

- a React UI
- a Node/Express server
- Drizzle/Postgres-backed persistence
- onboarding flows for creating companies and agents
- developer mode / workspace-oriented tooling
- company management, issue management, agents, onboarding dashboards, and related operational views

## 1.2 Current onboarding/runtime model

The current implementation is too flexible and too UI-driven.

It currently supports multiple adapter/runtime choices in onboarding, including OpenClaw and other local/remote adapter modes. This creates ambiguity, branching logic, and inconsistent runtime assumptions.

A company can appear in the UI before the full runtime environment is deterministically booted and verified.

This creates breakpoints such as:

- the UI showing a company that is not fully provisioned
- routes and company selection logic drifting from actual runtime state
- workspace paths existing in one layer but not another
- OpenClaw being treated as optional rather than foundational
- route/sidebar/settings behavior becoming inconsistent when state is partially valid or stale

## 1.3 Existing useful building blocks

The codebase already contains partial building blocks that should be reused where appropriate:

### CLI and runtime setup

- `cli/src/commands/onboard.ts`
- `cli/src/commands/run.ts`
- `cli/src/index.ts`

These currently handle Paperclip configuration, startup, doctor checks, and first-run setup.

### Compiler/provision bridge

- `server/src/services/compiler-bridge.ts`

This already exposes methods such as:

- compile
- list compiled outputs
- provision
- validate

### Instance + manifest/service layer

- `server/src/services/instance.ts`

This already contains concepts like:

- instance manifests
- OpenClaw linkage tracking
- Paperclip import linkage tracking
- validation of workspace structure
- import of generated bundles into Paperclip

### Docker and local quickstart surface

The repo already has:

- `docker-compose.yml`
- `docker-compose.quickstart.yml`
- Dockerfiles

These indicate the product is already partially oriented toward containerized/local boot.

### Developer mode / workspace access

Paperclip already has workspace-oriented capabilities that imply a future where it can inspect, read, and write the provisioned OpenClaw file tree.

## 1.4 Known logic weakness we are intentionally replacing

Today’s system still allows UI state and route state to get ahead of infrastructure truth.

This must be corrected systemically, not patched around.

The new architecture must make infrastructure readiness and provisioning state authoritative.

---

# 2. What We Need To Change It To

## 2.1 Product decision: OpenClaw only

We are making a deliberate product decision:

- Paperclip will use **OpenClaw 100% of the time** as the runtime substrate.
- We are removing the multi-adapter ambiguity from the main onboarding path.
- The provisioning pipeline should assume OpenClaw is the standard runtime and bootstrap target.

This means:

- OpenClaw is not one option among many
- OpenClaw is the default and canonical runtime
- onboarding should no longer ask the user to choose among runtime adapters in the main flow

## 2.2 Product decision: deterministic cold start

We want a deterministic cold-start experience.

The intended sequence is:

1. bring up infrastructure
2. bring up OpenClaw runtime
3. bring up Paperclip and connect it to OpenClaw
4. verify file/workspace visibility and runtime connectivity
5. then invoke Claude-based generation/bootstrap logic
6. then activate the company in the normal Paperclip UI

This sequencing is not optional.

## 2.3 Product decision: Anthropic-backed generation worker

We will use a Claude-based SDK/agent worker with Anthropic credentials to generate and evolve the OpenClaw workspace content.

For the purposes of this implementation, assume:

- Anthropic-backed generation is the canonical content-generation path
- generated content is written into the company’s provisioned OpenClaw workspace
- Paperclip should be aware of the job lifecycle and status, but the orchestration worker is allowed to perform file generation inside the workspace

## 2.4 Product decision: vanilla OpenClaw boilerplate as the base

Each newly provisioned company should begin from a deterministic baseline:

- a vanilla OpenClaw file/template/bootstrap layout
- copied or initialized into a company workspace
- then extended/customized by the Claude-based generation worker

This vanilla baseline must be versioned, stable, and reproducible.

---

# 3. What The End State Should Look Like

## 3.1 High-level end state

A user should be able to go from a cold start to a functioning company through a hardened provisioning pipeline.

At the system level:

- Docker can boot the required local/containerized services reliably
- OpenClaw is started in a known, deterministic way
- Paperclip is started in a known, deterministic way
- Paperclip and OpenClaw share a deterministic workspace relationship
- Anthropic-backed generation can read/write the provisioned workspace
- new companies are provisioned through the same repeatable pipeline every time

## 3.2 User-facing end state

The user experience should be simplified.

### First-run / instance setup

The system should verify or establish:

- Docker availability
- Paperclip readiness
- Anthropic credential presence
- OpenClaw template/runtime readiness
- known workspace root and known runtime linkage

### Company creation

The user should provide only the information needed to define the company:

- company name
- company description
- optionally mission/context/constraints if productized

The main flow should not ask the user to choose among runtime adapters.

### Provisioning behavior

When the user creates a new company, the system should:

- create a provisioning record/job
- create the company workspace from the vanilla OpenClaw baseline
- start or attach the OpenClaw runtime for that company/workspace
- verify connectivity and workspace visibility
- run the Claude-based bootstrap/generation worker
- populate initial files/roles/agents
- create or finalize the Paperclip company representation
- only then mark the company active in the normal board/sidebar flow

## 3.3 Technical end state

The system should have a real state machine, not ad hoc inferred state.

### Instance/system state

At minimum, the system should be able to represent something like:

- `uninitialized`
- `configuring`
- `ready`
- `degraded`
- `failed`

### Company lifecycle state

At minimum, the company lifecycle should be explicit, such as:

- `draft`
- `provisioning_infra`
- `provisioning_connection`
- `provisioning_bootstrap`
- `active`
- `failed`
- `archived`

The exact names may differ, but the semantics must exist.

The key invariant is:

**a company must not be treated as a normal active company until infrastructure, runtime, workspace linkage, and bootstrap generation have all reached a verified success checkpoint.**

---

# 4. Architectural Invariants

The implementation must obey these rules.

## 4.1 Infrastructure truth is authoritative

UI state must not outrun infrastructure truth.

The source of truth for whether a company is usable must come from verified provisioning state, not from optimistic UI assumptions.

## 4.2 OpenClaw is foundational, not optional

The main path must assume OpenClaw.

If alternative adapters remain in the codebase temporarily for backward compatibility, they must not be the primary product path and must not define the new architecture.

## 4.3 Company activation is delayed until verified readiness

Creating a company does not mean the company is active.

A company becomes active only after the provisioning pipeline completes successfully.

## 4.4 Workspace linkage must be deterministic

Paperclip must know exactly:

- where the company workspace lives
- how that workspace is mounted into the relevant container/runtime environment
- which URL/path/port is used for Paperclip-to-OpenClaw communication
- which path the generation worker reads/writes

No browser-only hacks or brittle inferred URLs should define core connectivity.

## 4.5 Progress and failures must be observable

Provisioning must be implemented as an observable job or workflow, not as opaque side effects.

The system should track:

- current phase
- logs or progress messages
- last error
- retryability
- final artifacts and linkage

## 4.6 Normal navigation must honor lifecycle state

Sidebar, dashboard redirects, routing, company selection, and settings pages must all honor lifecycle state consistently.

For example:

- `archived` companies should not behave like active companies
- `provisioning` companies should not appear as fully normal/active board targets
- `failed` companies should surface recovery actions, not broken board experiences

---

# 5. The Concrete End-to-End Boot Sequence

Implement a deterministic sequence that conceptually behaves like this.

## 5.1 Instance readiness phase

Before any company provisioning begins, the system ensures:

- Docker is installed and reachable
- required images/build contexts exist
- Paperclip configuration is valid
- Anthropic key/secret is configured
- OpenClaw baseline/template exists
- workspace root exists
- Paperclip runtime is able to talk to the expected local/container environment

If these conditions are not met, the system should not pretend the environment is ready.

## 5.2 Company provisioning phase

When the user submits a new company:

- create a new provisioning job
- create a company record in a non-active lifecycle state, or create a draft/provision record that later materializes into an active company
- assign deterministic workspace paths/IDs/slugs
- initialize the company workspace from the vanilla OpenClaw baseline

## 5.3 Runtime bring-up phase

Then:

- start or attach the OpenClaw runtime/container for the company
- verify the expected health endpoint or runtime readiness condition
- verify the workspace path from the server side
- verify the runtime and mounted workspace agree on the file tree

## 5.4 Paperclip/OpenClaw marriage phase

Then:

- bind the company to Paperclip in a formal, persisted way
- store the workspace path, runtime linkage, gateway URL, and any relevant manifest state
- ensure Developer Mode or equivalent server-side file access can see the workspace
- ensure Paperclip can call the runtime using the correct internal connectivity model

## 5.5 Bootstrap generation phase

Then:

- invoke the Claude-based generation worker
- give it the company name/description and baseline template
- allow it to generate or refine:
  - role folders
  - agent definitions
  - company instructions
  - workspace documents
  - role/task metadata
- write those outputs into the provisioned OpenClaw workspace

This phase must report progress and failures.

## 5.6 Activation phase

Only after the generation/bootstrap pipeline reaches the defined ready checkpoint should the company be transitioned to `active` and shown as a normal company in Paperclip navigation.

---

# 6. What Success Is Defined As

The following are the acceptance criteria. The project is not complete unless these are true.

## 6.1 Product success

A first-time user can:

- start the system from a cold local/containerized state
- complete a simplified onboarding flow
- create a company with name + description
- watch a provisioning process occur
- end with a usable, active company inside Paperclip
- see that company represented consistently in the sidebar, routes, settings, and workspace-linked tooling

## 6.2 Infrastructure success

From a cold start, the system can deterministically:

- bring up Paperclip
- bring up or attach OpenClaw
- establish shared workspace linkage
- confirm runtime readiness
- run generation/bootstrap jobs

without relying on brittle manual steps or hidden environment assumptions.

## 6.3 Data-model success

The system has explicit lifecycle/provisioning state for:

- instance/system readiness
- company provisioning
- active vs archived vs failed status

and these states are used consistently by backend and frontend code.

## 6.4 UX success

The main onboarding and company-creation flow is materially simpler than today.

The main path should not ask users to understand internal adapter differences.

The user should experience:

- one canonical runtime path
- visible provisioning progress
- actionable failure states
- deterministic success semantics

## 6.5 Engineering success

The implementation should include:

- tests for lifecycle and routing behavior
- tests for provisioning state transitions where practical
- robust logging around provisioning and runtime linkage
- clear module boundaries between UI, orchestration, provisioning, runtime integration, and generation worker logic

## 6.6 Reliability success

The system should prevent the class of bug where a company appears active in one surface but hidden or invalid in another because lifecycle state and routing logic disagree.

---

# 7. Team Structure: Spawn Specialized Developers

Create a specialized implementation team. You may choose the exact naming, but the responsibilities must be covered.

## 7.1 Staff Engineer / Orchestrator

Responsible for:

- overall architecture
- dependency sequencing
- integration decisions
- definition of done
- avoiding partial local fixes that violate the end-state architecture

## 7.2 Backend Lifecycle / Domain Engineer

Responsible for:

- lifecycle state model
- provisioning jobs/state persistence
- company activation semantics
- backend APIs for readiness/provisioning progress/failure/retry
- migration strategy for new tables/columns/state transitions

## 7.3 Runtime Provisioning / Docker Engineer

Responsible for:

- deterministic Docker/OpenClaw bring-up
- workspace mount design
- internal connectivity model
- health checks
- instance readiness checks
- reliable local quickstart/boot scripts

## 7.4 OpenClaw Integration Engineer

Responsible for:

- vanilla OpenClaw baseline/template strategy
- workspace initialization
- runtime linkage details
- expected file layout contracts
- manifest/binding model between OpenClaw and Paperclip

## 7.5 Claude SDK / Generation Worker Engineer

Responsible for:

- Anthropic-backed generation/bootstrap flow
- file-writing behavior inside provisioned workspaces
- prompt and tool contracts for generating roles/agents/files
- checkpointing and progress reporting
- failure recovery semantics for generation jobs

## 7.6 Frontend / UX Engineer

Responsible for:

- replacing current multi-adapter onboarding in the main path
- implementing instance readiness and company provisioning UX
- progress screens / failure states / retry paths
- ensuring sidebar, settings, redirects, and dashboards honor lifecycle state consistently

## 7.7 QA / Reliability Engineer

Responsible for:

- test plans
- regression coverage
- route/lifecycle consistency verification
- cold-start verification steps
- failure-injection scenarios

---

# 8. Required Workstreams

The following workstreams should be planned and executed.

## Workstream A: Current-state audit

Before large edits, audit and map:

- current onboarding flow
- current adapter selection logic
- current OpenClaw integration points
- current Docker/quickstart surfaces
- current company/instance status fields
- current routing assumptions around active vs archived companies
- current Developer Mode and workspace access surfaces

Produce a concise architecture note before invasive changes.

## Workstream B: Lifecycle model and persistence

Design and implement:

- company lifecycle/provisioning states
- provisioning job records and progress tracking
- retry/failure semantics
- any required migrations

This is foundational and should happen early.

## Workstream C: Deterministic runtime bring-up

Design and implement:

- deterministic OpenClaw workspace initialization from the vanilla baseline
- Docker/OpenClaw startup or attachment logic
- health and readiness checks
- stable path and network contracts

## Workstream D: Paperclip/OpenClaw binding layer

Design and implement:

- persisted linkage between company, workspace, runtime, manifest, and gateway
- server-side verification of workspace visibility
- explicit APIs for runtime/provisioning state

## Workstream E: Generation/bootstrap worker

Design and implement:

- Claude-based workspace generation pipeline
- clear inputs and outputs
- progress reporting
- idempotency/retry behavior where possible

## Workstream F: Frontend rework

Design and implement:

- instance readiness UI
- simplified company creation UI
- provisioning progress/failure/retry UI
- lifecycle-aware navigation and routing

## Workstream G: Testing and hardening

Implement:

- regression tests
- integration tests where feasible
- route/lifecycle consistency checks
- cold-start validation steps
- logs and observability improvements

---

# 9. Constraints and Non-Goals

## Constraints

- Reuse existing useful building blocks where practical
- Do not preserve legacy flexibility if it conflicts with the deterministic OpenClaw-first architecture
- Make infrastructure truth authoritative over UI optimism
- Do not allow active-company semantics before readiness is verified
- Do not invent brittle browser-only connectivity assumptions for core runtime linkage

## Non-goals

The goal is not to preserve every current onboarding branch exactly as-is.

The goal is not to produce a thin patch over the current system.

The goal is not to keep OpenClaw as just one adapter among many in the main product experience.

The goal is not to hide provisioning complexity while still relying on manual, implicit runtime steps.

---

# 10. Implementation Guidance

## 10.1 Favor phased delivery

Implement in coherent phases, for example:

1. architecture audit + lifecycle model
2. runtime/provisioning backend
3. frontend onboarding/provisioning UX
4. generation worker integration
5. hardening and regression coverage

## 10.2 Keep definitions explicit

Do not rely on inferred meanings like “if this field exists then company is probably ready.”

Readiness, activation, archive state, and failure state should be explicit.

## 10.3 Make failure states first-class

A failed provisioning attempt should produce:

- clear status
- last known phase
- relevant logs
- retry or rebuild action

not a broken partially active company.

## 10.4 Preserve operator visibility

The system should expose enough information for an operator/developer to understand:

- what phase is running
- which resource/path/runtime is being targeted
- what failed
- what to retry

---

# 11. Deliverables

Your team should produce at minimum:

- code changes implementing the new lifecycle/provisioning model
- updated onboarding and provisioning UX
- deterministic OpenClaw-first runtime bootstrap path
- Anthropic-backed bootstrap/generation integration
- tests and validation steps
- updated developer documentation explaining the new boot sequence and architecture

---

# 12. Definition of Done

You are done only when all of the following are true:

- a cold-start local/containerized bring-up works deterministically
- OpenClaw is the canonical runtime path in the main flow
- company creation uses a provisioning pipeline instead of immediate activation
- Paperclip and OpenClaw are linked through explicit, persisted, verified bindings
- the generation worker can write into the correct company workspace
- the company becomes active only after verified readiness
- lifecycle state is honored consistently across sidebar, redirects, dashboard, settings, and related views
- failures are observable and recoverable
- the system is materially harder to break than the current one

---

# 13. First Instruction To The Team

Begin by producing a concise architecture and execution plan that includes:

- current-state map
- proposed data model changes
- provisioning job design
- Docker/OpenClaw bootstrap design
- frontend flow redesign
- generation worker integration plan
- risk register
- implementation phases and ordering

Then begin implementation in disciplined phases, keeping the end-state architecture fixed and avoiding piecemeal local fixes that preserve the current broken model.
