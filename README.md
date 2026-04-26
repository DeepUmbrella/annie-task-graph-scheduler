# Annie TaskGraphScheduler

TaskGraphScheduler is the Phase 1 MVP scheduler for Annie Workflow System.

It turns a `WritingPlansWorkflow` DAG plan into safe execution waves with dependency checks, file-conflict serialization, worker assignment records, review gates, local state persistence, and auditable messaging.

## Current Status

Project initialized from:

- `docs/annie_task_graph_scheduler_prd (1).md`
- `docs/task_graph_scheduler_implementation_plan.md`

## Planned Commands

```txt
annie-tgs init --plan plan.json
annie-tgs next-wave --workflow wf_001
annie-tgs dispatch --workflow wf_001 --wave wave_001
annie-tgs submit-result --workflow wf_001 --result result.json
annie-tgs review-wave --workflow wf_001 --wave wave_001
annie-tgs recover --workflow wf_001
annie-tgs status --workflow wf_001
```

## Development

```txt
npm install
npm run typecheck
npm run build
npm test
```
