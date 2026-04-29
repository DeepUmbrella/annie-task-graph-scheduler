# Phase 11 Plan: Intent To Planner Agent Handoff

## Context

Phase 10 proved the inbound smoke loop:

```txt
OpenClaw/Annie message -> inbound log -> workflow intent
```

The next smallest workflow step is to hand the created intent to a team controller/planner agent through the existing mailbox system.

Phase 11 still does not ask a real planner agent to produce a DAG. It only creates the planning request message and persists it in the planner agent mailbox.

## Scope

Phase 11 does:

- define a minimal local team snapshot model
- define a planning request message type
- create a planner handoff from workflow intent
- write the handoff message into the team controller mailbox
- connect inbound intent creation to automatic planner handoff

Phase 11 does not:

- read real OpenClaw config yet
- call real OpenClaw sessions
- generate DAG plans
- initialize workflow state from planner output
- dispatch execution tasks

## Tasks

### T060 Team snapshot minimal model

- Add `TeamSnapshot`, `TeamAgent`, and permissions model.
- Provide default local team with `team-lead-agent`.
- Keep team lead inside `agents[]`.

### T061 Intent planner handoff

- Add `PLANNING_REQUEST` message type.
- Create planning request from `WorkflowIntent`.
- Persist message into planner mailbox.
- Include `intent_id` and `goal` in payload.

### T062 Inbound auto-handoff

- After inbound server creates an intent, automatically create planner handoff.
- Return planner mailbox metadata in HTTP response.
- Print `[annie-tgs:planner]` log line.

### T063 Phase 11 acceptance

- Run typecheck/build/test.
- Update progress README and agent handoff state.

## Verification

```txt
npm run typecheck
npm run build
npm test
```

Manual smoke:

```txt
npm run build
npm run serve -- --root .annie --host 127.0.0.1 --port 4317
curl -sS -X POST http://127.0.0.1:4317/openclaw/messages \
  -H 'content-type: application/json' \
  -d '{"type":"USER_MESSAGE","from":"openclaw","to":"annie","message":"创建一个网站"}'
```

Expected observable outputs:

- `.annie/intents/<intent_id>.json`
- `.annie/workflows/<intent_id>/mailboxes/team-lead-agent/inbox.jsonl`
- terminal log `[annie-tgs:planner] handed off ...`
