# Phase 10 Plan: OpenClaw Inbound Intake Smoke Loop

## Context

Phase 09 documented the local workflow handoff contract. The next smallest executable step is not full autonomous orchestration yet. It is proving that an OpenClaw/Annie message can enter TaskGraphScheduler and become a durable workflow intent.

This phase intentionally stays small:

- no real planner agent call
- no automatic DAG generation
- no task dispatch
- no real OpenClaw session spawning

## Scope

Phase 10 does:

- start a local inbound HTTP server
- accept OpenClaw/Annie message payloads
- print observable logs when messages arrive
- persist inbound messages to JSONL
- convert inbound messages into workflow intents
- persist workflow intents to local JSON

Phase 10 does not:

- call real OpenClaw planner agents
- build team snapshots
- trigger DAG planning
- initialize workflows from intents
- dispatch tasks to agents

## Tasks

### T057 Local OpenClaw inbound server

- Add local HTTP server.
- Add `serve` CLI command.
- Accept `POST /openclaw/messages`.
- Log received messages to terminal.
- Persist inbound payloads to `.annie/inbound/openclaw-messages.jsonl`.

### T058 Inbound message to workflow intent

- Add workflow intent model.
- Extract `goal` / `message` / `text` from inbound payload.
- Persist intent to `.annie/intents/<intent_id>.json`.
- Return `intent_id` and `intent_path` from the inbound endpoint.
- Log created intent in terminal.

### T059 Phase 10 acceptance

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

- terminal logs `[annie-tgs:inbound]`
- terminal logs `[annie-tgs:intent]`
- `.annie/inbound/openclaw-messages.jsonl`
- `.annie/intents/<intent_id>.json`
