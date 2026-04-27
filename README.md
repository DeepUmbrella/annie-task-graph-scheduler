# Annie TaskGraphScheduler

TaskGraphScheduler is the DAG scheduler for Annie Workflow System.

It turns a `WritingPlansWorkflow` DAG plan into safe execution waves with dependency checks, policy-aware scheduling, file-conflict prediction, worker assignment records, review gates, local state persistence, and auditable messaging.

## Current Status

Project initialized from:

- `docs/annie_task_graph_scheduler_prd (1).md`
- `docs/task_graph_scheduler_implementation_plan.md`

Phase status:

- Phase 01 MVP: done
- Phase 02 Enhanced Scheduling: done

Phase 02 adds:

- Agent load-aware assignment
- Risk scoring and risk-aware scheduling
- Configurable retry policy
- Exact, directory, glob, and unknown-file conflict prediction
- Structured Scheduler decision output

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
