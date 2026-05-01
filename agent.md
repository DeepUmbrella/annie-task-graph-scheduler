# Agent Guide

This file is the quick handoff guide for any editor client or coding agent working on Annie TaskGraphScheduler.

## Project Snapshot

Annie TaskGraphScheduler is a TypeScript / Node.js DAG scheduler for Annie Workflow System.

It turns a `WritingPlansWorkflow` DAG plan into safe execution waves with:

- DAG validation
- ready / blocked dependency resolution
- wave scheduling
- file conflict prediction
- risk-aware scheduling
- Agent load-aware worker assignment
- structured worker result collection
- ReviewGate
- local state persistence
- mailbox-based MessageBus
- recovery
- OpenClaw transport adapter boundary

## Source Of Truth

Read these first:

1. `docs/annie_task_graph_scheduler_prd (1).md`
2. `docs/multi_agent_autonomous_workflow_prd.md`
3. `docs/task_graph_scheduler_implementation_plan.md`
4. `progress/README.md`
5. Latest phase summary under `progress/phase-XX/phase-summary.md`

Progress files are part of the product process, not optional notes. For detailed progress update rules, use `progress/README.md`.

## When To Update This File

`agent.md` is a cross-client handoff guide. It should stay stable and high signal.

Update this file when:

- A new phase starts or finishes.
- The current project status changes at a phase level.
- Important directories, modules, commands, or architecture rules change.
- The validation baseline changes, such as the expected test count.
- New collaboration rules are added.
- A repeated agent/editor pitfall is discovered and should be documented.

Do not update this file for:

- Every ordinary task completion.
- Small bug fixes.
- Routine test additions.
- Internal implementation details that do not change how agents should work.

Use `progress/` for fine-grained task progress. Use `agent.md` for stable handoff rules and phase-level project state.

## Current Progress

读取progress/README.md文件: 获取项目进度，以及项目进度更新规则。

## Development Rules

When continuing development:

1. Check `git status --short`.
2. Read the latest phase summary.
3. Pick the first `todo` task in the current phase.
4. Follow the task update workflow in `progress/README.md`.
5. Implement the smallest complete slice.
6. Run validation.
7. Commit with a focused message.

If a task is ambiguous or changes product semantics, stop and ask the user before proceeding.

## Git Workflow

Use small commits aligned with progress tasks.

Good commit examples:

```txt
docs: plan phase 03 visualization
feat: add workflow board model
feat: render dag graph data
test: add phase 03 acceptance coverage
```

Do not mix unrelated progress updates and feature code unless they are for the same task.

## Architecture Map

Important modules:

```txt
src/models/
  plan.ts
  task.ts
  wave.ts
  workflow.ts
  message.ts
  audit.ts

src/validation/
  plan_loader.ts
  dag_validator.ts

src/scheduler/
  dependency_resolver.ts
  conflict_detector.ts
  risk_scorer.ts
  scheduler.ts

src/execution/
  worker_pool.ts
  result_collector.ts
  retry_policy.ts
  review_gate.ts

src/communication/
  message_bus.ts
  mailbox_store.ts
  protocol_validator.ts
  openclaw_adapter.ts

src/storage/
  state_store.ts
  recovery_manager.ts
```

## Implemented Capabilities

Phase 01:

- DAG plan loading
- DAG validation and topological order
- ready / blocked dependency resolution
- basic wave generation
- exact file conflict serialization
- worker assignment
- result collection
- ReviewGate
- StateStore and AuditLog
- MessageBus and MailboxStore
- RecoveryManager
- OpenClaw adapter boundary

Phase 02:

- Nested scheduling policy model
- Agent runtime state
- capability-aware and load-aware worker assignment
- task risk scoring
- risk-aware ready task ordering
- configurable retry policy
- exact / directory / glob / unknown-file conflict prediction
- structured scheduler decision output
- Phase 02 e2e acceptance coverage

Phase 03:

- Visualization data model (VisualizationModel, board/dag/waves/failures views)
- Workflow board projection
- DAG graph projection (nodes with highlight, dependency edges with status)
- Wave progress projection
- Failure tracking projection with downstream impact (BFS traversal)
- Visualization export function and CLI visualize command
- Phase 03 e2e acceptance coverage

Phase 04:

- TaskTemplate model and TemplateRegistry interface
- Template registry with register/get/list/findByTag
- 3 builtin templates (api-design-implement-test, parallel-frontend-backend, full-stack-review)
- instantiateTemplate with plan_id, task_overrides, extra_tasks, execution_policy_overrides
- CLI template list/show/instantiate commands
- Phase 04 acceptance coverage

Phase 05:

- Cross-project scheduling model
- Local Project Registry
- Global ready task queue builder
- Cross-project dispatch planner
- Global Agent pool view
- CLI project / queue commands
- Phase 05 acceptance coverage

Phase 06:

- CLI init from DAG plan
- CLI next-wave orchestration
- CLI dispatch worker assignment
- CLI submit-result result collection
- CLI review-wave ReviewGate
- Execution CLI e2e coverage

Phase 07:

- MemoryRecord / MemoryCandidate / MemoryAdapter boundary
- Execution result memory candidate extraction
- Scheduling preference memory candidate extraction
- Template pattern memory candidate extraction
- Local JSONL MemoryStore
- CLI memory extract / write / list commands

Phase 08:

- Scheduler / CLI task state-change audit coverage
- CLI structured error JSON mode
- MessageBus / MailboxStore recovery hardening
- PRD hardening acceptance coverage

Phase 09:

- Plan handoff validation CLI
- Workflow execution report
- Handoff examples and docs
- Workflow handoff acceptance coverage

Phase 10:

- Local OpenClaw inbound HTTP server
- `serve` CLI command
- inbound message JSONL persistence
- workflow intent creation from inbound payload
- local smoke-test documentation

Phase 11 completed:

- Minimal team snapshot model
- Intent to planner agent handoff
- Inbound auto-handoff to planner mailbox
- Planning request mailbox acceptance coverage

Phase 12 completed:

- Real OpenClaw CLI client
- Explicit `serve --openclaw-planner-agent <agent_id>` transport
- No default controller/planner agent selection
- Preserve local mock transport as the default path

Phase 13 completed:

- `REQUIREMENT_CLARIFICATION_REQUEST` protocol
- Planner reply intake into Annie mailbox
- `POST /openclaw/planner-replies`
- No TaskDagPlan parsing yet

Phase 14 completed:

- Generalize planner reply intake into agent message intake
- Add `POST /openclaw/agent-messages`
- Keep `POST /openclaw/planner-replies` as compatibility alias
- Preserve Phase 13 behavior while removing planner-specific core naming

Phase 15 completed:

- Runtime-agnostic agent / node chooses its own action and `to`
- Nodes do not have to be OpenClaw agents; OpenClaw is only one runtime / transport adapter
- Scheduler validates action policy, writes mailbox, and records/audits
- Add runtime-neutral `POST /agent-messages`
- Remove `/openclaw/agent-messages` runtime-specific agent message endpoint
- Remove `/openclaw/planner-replies` compatibility endpoint
- Remove `planner_reply` compatibility module
- `agent_message` payload must explicitly include `action` and `to`

Phase 16 planned:

- Runtime-agnostic Node Registry
- Team Composition model
- Single-member team support
- `POST /nodes/register`
- `GET /nodes`
- Team context validation boundary

Phase 16 completed:

- Runtime-agnostic `RegisteredNode` and `TeamComposition` models
- `NodeRegistrationProposal` validation
- Local `.annie/nodes/registry.json` persistence
- Runtime-neutral `POST /nodes/register`
- Runtime-neutral `GET /nodes`
- Single-member team support
- Team context membership validation
- Action policy derivation from registered nodes

Phase 17 planned:

- Runtime detector boundary
- OpenClaw discovery adapter
- Candidate node list
- Discovery metadata persistence
- `GET /nodes/candidates`

Phase 17 completed:

- Runtime discovery models
- Candidate node model separated from RegisteredNode
- Local `.annie/discovery/runtime-candidates.json` persistence
- OpenClaw discovery adapter for `openclaw agents list --json`
- Runtime unavailable metadata handling
- Runtime-neutral `GET /nodes/candidates`

Phase 18 planned:

- Node registration interview template
- Runtime reply parser for `NodeRegistrationProposal`
- Registration approval boundary
- Registration semantics: requested actions are not automatically granted

Phase 18 completed:

- Node registration interview template
- Runtime reply parser for `NodeRegistrationProposal`
- Registration approval boundary
- Default deny-all approval policy
- Explicit `granted_actions` registration semantics

Phase 19 planned:

- `delegate_to_member` action
- Team-scoped delegation validation
- Agent message `team_context` intake
- Registry-derived delegation policy

Phase 19 completed:

- `delegate_to_member` action
- Delegation permission for `TASK_ASSIGNED`
- Team-scoped delegation validator
- Agent message `team_context` parsing
- Delegation mailbox delivery
- Registry-derived delegation policy

Phase 20 planned:

- Plan proposal model and parser
- Plan proposal persistence
- `POST /plan-proposals`
- `GET /plan-proposals`
- No automatic workflow initialization from proposal intake

Phase 20 completed:

- Plan proposal model and parser
- TaskDagPlan validation through existing `loadPlan`
- Local `.annie/plans/proposals.json` persistence
- Runtime-neutral `POST /plan-proposals`
- Runtime-neutral `GET /plan-proposals`
- Proposal intake does not initialize workflow state

Phase 21 planned:

- Workflow bootstrap model
- Bootstrap workflow from plan proposal
- `POST /workflow-bootstrap`
- Bootstrap audit event
- No automatic next-wave / dispatch

Phase 21 completed:

- Workflow bootstrap model
- Bootstrap workflow from saved plan proposal
- Runtime-neutral `POST /workflow-bootstrap`
- Bootstrap writes `WORKFLOW_BOOTSTRAPPED` audit event
- Bootstrap creates pending workflow state without waves
- Bootstrap does not automatically dispatch or schedule the next wave

Phase 22 planned:

- Workflow scheduling model
- Schedule next wave service
- Runtime-neutral next-wave endpoint
- Next-wave CLI command
- Scheduling audit event
- No dispatch and no OpenClaw call in this phase

Next product direction:

- Multi-agent autonomous workflow PRD captured in `docs/multi_agent_autonomous_workflow_prd.md`
- Team lead/controller is a normal team member in `agents[]`
- Team agents can communicate with same-team peers through MessageBus/Mailbox
- Per-agent collaboration allowlists are not part of the preferred model
- Permissions and ProtocolValidator decide which message types are allowed

## Important Behavioral Constraints

- StateStore is the source of truth for workflow state.
- Agent messages do not directly change task state.
- Orchestrator / scheduler logic owns state transitions.
- Every meaningful state transition should have an audit event.
- ReviewGate must pass before scheduling the next wave.
- Existing Phase 01 behavior should remain compatible under default policy.
- OpenClaw is a transport adapter, not the collaboration protocol.

## If You Need To Plan A New Phase

Use the PRD roadmap:

```txt
Phase 3: Visualization
Phase 4: Long-term memory integration
Phase 5: Cross-project scheduling
```

Planning steps:

1. Create `progress/phase-XX/phase-summary.md`.
2. Create `progress/phase-XX/tasks/task-NNN-name.md` files.
3. Link the new phase from `progress/README.md`.
4. Commit the plan before implementation.

## Stop And Ask The User When

Stop and ask before proceeding if:

- A requirement affects product semantics.
- A new field changes the public plan schema in a non-backward-compatible way.
- A design choice could reasonably go in multiple directions.
- A task requires adding a new runtime dependency.
- Real OpenClaw integration details are missing.
- UI/visualization scope is unclear.

## Current Clean Baseline

Latest known completed state:

```txt
Phase 01: done
Phase 02: done
Phase 03: done
Phase 04: done
Phase 05: done
Phase 06: done
Phase 07: done
Phase 08: done
Phase 09: done
Phase 10: done
Phase 11: done
Phase 12: done
Phase 13: done
Phase 14: done
Phase 15: done
Phase 16: done
Phase 17: done
Phase 18: done
Phase 19: done
Phase 20: done
Phase 21: done
Phase 22: planned, next T110
npm run typecheck: pass
npm run build: pass
npm test: 200 passed
```
