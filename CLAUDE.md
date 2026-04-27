# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Annie TaskGraphScheduler is a TypeScript / Node.js DAG scheduler for Annie Workflow System. It transforms `WritingPlansWorkflow` DAG plans into safe execution waves with dependency resolution, policy-aware scheduling, conflict prediction, and audit trails.

## Development Commands

```txt
npm install              # Install dependencies
npm run typecheck        # TypeScript type checking
npm run build            # Build to dist/
npm test                 # Run all tests (baseline: 57 passed)
npm test:e2e             # Run e2e tests only
```

## Architecture

State flow: StateStore (source of truth) → Scheduler (owns transitions) → Execution (worker assignment) → Communication (MessageBus + MailboxStore)

Core modules:

- **models/**: Plan, Task, Wave, Workflow, Message, Audit schemas
- **validation/**: Plan loading and DAG validation
- **scheduler/**: Dependency resolution, conflict detection, risk scoring, wave scheduling
- **execution/**: Worker pool, result collection, retry policy, ReviewGate
- **communication/**: MessageBus, mailbox store, protocol validation, OpenClaw adapter
- **storage/**: StateStore persistence, RecoveryManager

## Progress Tracking

- `agent.md` - Cross-client handoff guide, phase-level status, architecture rules
- `progress/README.md` - Detailed task workflow and phase tracking
- `progress/phase-XX/` - Phase summaries and individual task files

Current status: Phase 01 (MVP) done, Phase 02 (Enhanced Scheduling) done

## Important Behavioral Constraints

- StateStore is the source of truth for workflow state
- Agent messages do not directly change task state; orchestrator/scheduler owns state transitions
- Every meaningful state transition should have an audit event
- ReviewGate must pass before scheduling the next wave
- Phase 01 behavior should remain compatible under default policy
- OpenClaw is a transport adapter, not the collaboration protocol

## Development Workflow

1. Check `git status --short`
2. Read latest phase summary from `progress/`
3. Pick first `todo` task in current phase
4. Follow task update workflow in `progress/README.md`
5. Run validation: `npm run typecheck && npm run build && npm test`
6. Commit with focused message

## When To Stop And Ask

Stop before proceeding if:
- A requirement affects product semantics
- A new field changes the public plan schema in a non-backward-compatible way
- A design choice could reasonably go in multiple directions
- Adding a new runtime dependency is required
- UI/visualization scope is unclear

## Planning New Phases

From PRD roadmap: Phase 3 (Visualization), Phase 4 (Long-term memory), Phase 5 (Cross-project scheduling)

Planning steps:
1. Create `progress/phase-XX/phase-summary.md`
2. Create `progress/phase-XX/tasks/task-NNN-name.md` files
3. Link from `progress/README.md`
4. Commit the plan before implementation

## Sources of Truth

Read these first when starting work:
1. `docs/annie_task_graph_scheduler_prd (1).md` - Product requirements
2. `docs/task_graph_scheduler_implementation_plan.md` - Implementation plan
3. `progress/README.md` - Task workflow rules
4. Latest `progress/phase-XX/phase-summary.md` - Current phase details