# Workflow Handoff Contract

This document describes the local handoff contract around TaskGraphScheduler.

It is intentionally local-only. The repository does not implement a real Annie Workflow System remote API yet.

## Upstream Input

`WritingPlansWorkflow` hands a DAG plan to TaskGraphScheduler as JSON.

Example:

```txt
examples/handoff/writing-plan-handoff.json
```

The plan must use:

- `plan_type: "dag"`
- a non-empty `tasks` array
- unique task ids
- `depends_on` references that point to tasks in the same plan
- no dependency cycles

Optional task metadata such as `expected_files`, `required_capabilities`, `risk`, and `preferred_agent` helps the scheduler choose safe waves.

## Validate The Handoff Plan

Use:

```txt
node dist/src/cli.js plan validate --plan examples/handoff/writing-plan-handoff.json
```

The command returns JSON with:

- `valid`
- `plan_id`
- `task_count`
- `topological_order`
- `dependency_edges`
- `risks`
- `required_capabilities`
- `preferred_agents`
- `execution_policy`

For machine-readable errors:

```txt
node dist/src/cli.js plan validate --plan examples/handoff/writing-plan-handoff.json --json-errors
```

## Start Execution

Use the existing execution CLI:

```txt
node dist/src/cli.js init --plan examples/handoff/writing-plan-handoff.json --workflow wf_handoff_example
node dist/src/cli.js next-wave --workflow wf_handoff_example
node dist/src/cli.js dispatch --workflow wf_handoff_example --wave wave_001
```

Task state remains owned by `StateStore`. Agent messages and mailbox records do not directly change task state.

## Downstream Output

`ExecutionWorkflow` or `Delivery` can read a structured report:

```txt
node dist/src/cli.js report --workflow wf_handoff_example
```

The report returns JSON with:

- workflow metadata
- task status counts
- wave status counts
- wave review summaries
- task-level execution summaries
- failure and blocked-task summaries
- handoff metadata

The report does not read or emit file contents. It only includes structured state fields and file/test counts.

## Current Boundary

Implemented:

- local plan validation
- local workflow state initialization
- local execution orchestration
- local execution report

Not implemented:

- real Annie Workflow System remote API
- real OpenClaw session spawning
- automatic code modification
- UI handoff screens

Any real Annie Workflow API integration should be planned in a later phase after the interface is provided.
