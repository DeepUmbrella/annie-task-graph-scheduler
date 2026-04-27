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
2. `docs/task_graph_scheduler_implementation_plan.md`
3. `progress/README.md`
4. Latest phase summary under `progress/phase-XX/phase-summary.md`

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

Phase 07 planned:

- MemoryRecord / MemoryCandidate / MemoryAdapter boundary
- Execution result memory candidate extraction
- Scheduling preference memory candidate extraction
- Template pattern memory candidate extraction
- Local JSONL MemoryStore
- CLI memory extract / write / list commands

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
Phase 07: in_progress, T042-T047 done, next T048
npm run typecheck: pass
npm run build: pass
npm test: 114 passed
```
