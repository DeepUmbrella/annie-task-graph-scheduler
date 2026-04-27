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

Progress files are part of the product process, not optional notes. Keep them updated with code changes.

## Current Progress

Completed:

- `progress/phase-01/phase-summary.md` - Phase 01 MVP is `done`
- `progress/phase-02/phase-summary.md` - Phase 02 Enhanced Scheduling is `done`

Latest completed task:

- `progress/phase-02/tasks/task-015-phase-02-acceptance.md`

Next likely phase from the PRD:

- Phase 03: Visualization
  - Workflow board
  - DAG graph display
  - Wave execution progress
  - Failed task tracking

Do not start Phase 03 implementation directly. First create `progress/phase-03/phase-summary.md` and task files, then commit the plan.

## Development Rules

When continuing development:

1. Check `git status --short`.
2. Read the latest phase summary.
3. Pick the first `todo` task in the current phase.
4. Mark that task `in_progress` before code changes.
5. Implement the smallest complete slice.
6. Run validation.
7. Mark the task `done`.
8. Commit with a focused message.

If a task is ambiguous or changes product semantics, stop and ask the user before proceeding.

## Progress Directory Convention

```txt
progress/
└── phase-XX/
    ├── phase-summary.md
    └── tasks/
        ├── task-001-example.md
        └── task-002-example.md
```

Task status values:

```txt
todo
in_progress
blocked
review
done
```

Each task file should include:

- Status
- Goal
- Scope
- Acceptance criteria
- Related code
- Completion record after implementation
- Validation commands and results

## Validation Commands

Run these before marking a task done:

```txt
npm run typecheck
npm run build
npm test
```

Current expected test state after Phase 02:

```txt
57 passed
```

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
npm run typecheck: pass
npm run build: pass
npm test: 57 passed
```

