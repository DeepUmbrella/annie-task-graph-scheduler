# Annie TaskGraphScheduler

DAG scheduler for Annie Workflow System. Transforms `WritingPlansWorkflow` DAG plans into safe execution waves with dependency resolution, policy-aware scheduling, file-conflict prediction, review gates, agent dispatch, result intake, and audit trails.

## Requirements

- Node.js >= 20.0.0

## Install

```bash
git clone <repo-url> && cd annie-task-graph-scheduler
npm install
```

## Build & Start

```bash
npm run build        # compile TS to dist/
npm run typecheck    # type-check without emitting
npm test             # run all tests (baseline: 215 passed)
npm run serve        # start HTTP server on 127.0.0.1:4317
```

## Quick Start

### 1. Validate a plan

```bash
node dist/src/cli.js plan validate --plan examples/handoff/writing-plan-handoff.json
```

### 2. Initialize a workflow

```bash
node dist/src/cli.js init --plan examples/handoff/writing-plan-handoff.json
```

Output:

```json
{
  "workflow_id": "wf_plan_handoff_example",
  "plan_id": "plan_handoff_example",
  "status": "initialized",
  "task_count": 4,
  "state_path": ".annie/wf_plan_handoff_example/state.json"
}
```

### 3. Schedule the next wave

```bash
node dist/src/cli.js next-wave --workflow wf_plan_handoff_example
```

Returns ready tasks, blocked tasks, scheduler decision, and the new wave.

### 4. Dispatch the wave to agents

```bash
node dist/src/cli.js workflow-dispatch --workflow wf_plan_handoff_example
```

Assigns workers, generates dispatch messages, and advances wave status.

### 5. Submit an agent result

Create `result.json`:

```json
{
  "task_id": "T1",
  "node_id": "docs-agent",
  "status": "completed",
  "output": { "summary": "Handoff contract defined." },
  "changed_files": ["docs/workflow_handoff_contract.md"]
}
```

```bash
node dist/src/cli.js agent-result \
  --workflow wf_plan_handoff_example \
  --from docs-agent \
  --result result.json
```

### 6. Review a wave and advance

```bash
node dist/src/cli.js review-wave --workflow wf_plan_handoff_example --wave wave_001
```

After review passes, repeat steps 3-6 for subsequent waves.

### 7. Check workflow status

```bash
node dist/src/cli.js status --workflow wf_plan_handoff_example
```

### 8. Visualize & report

```bash
node dist/src/cli.js visualize --workflow wf_plan_handoff_example
node dist/src/cli.js report --workflow wf_plan_handoff_example
```

## CLI Reference

```txt
annie-tgs init --plan <plan.json> [--workflow <id>]
annie-tgs next-wave --workflow <id>
annie-tgs workflow-dispatch --workflow <id> [--wave <id>]
annie-tgs agent-result --workflow <id> --from <node_id> --result <result.json> [--wave <id>]
annie-tgs dispatch --workflow <id> --wave <id>
annie-tgs submit-result --workflow <id> --result <result.json>
annie-tgs review-wave --workflow <id> --wave <id>
annie-tgs status --workflow <id>
annie-tgs recover --workflow <id>
annie-tgs visualize --workflow <id>
annie-tgs report --workflow <id>
annie-tgs serve [--host <host>] [--port <port>] [--openclaw-planner-agent <id>]
annie-tgs template list | show | instantiate
annie-tgs project register | list | show
annie-tgs queue build | plan
annie-tgs memory extract | write | list
annie-tgs plan validate --plan <plan.json>
```

Global option: `--json-errors` prints errors as JSON to stderr.

