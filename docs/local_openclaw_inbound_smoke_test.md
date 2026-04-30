# Local OpenClaw Inbound Smoke Test

This is the smallest local step for checking that an OpenClaw/Annie message reaches TaskGraphScheduler.

## Start The Project

Build once:

```txt
npm run build
```

Start the inbound server:

```txt
npm run serve -- --root .annie --host 127.0.0.1 --port 4317
```

By default the planner handoff uses the local mock transport. To send the planner request to a real OpenClaw agent, explicitly pass the planner agent id:

```txt
npm run serve -- --root .annie --host 127.0.0.1 --port 4317 --openclaw-planner-agent develop-team
```

The agent id must come from OpenClaw:

```txt
openclaw agents list --json
```

Expected startup output includes:

```txt
[annie-tgs:server] listening on http://127.0.0.1:4317
[annie-tgs:server] inbound log file .annie/inbound/openclaw-messages.jsonl
[annie-tgs:server] planner transport mock
```

## Endpoint

Send OpenClaw/Annie messages to:

```txt
POST http://127.0.0.1:4317/openclaw/messages
```

Send any OpenClaw agent message back to TaskGraphScheduler:

```txt
POST http://127.0.0.1:4317/openclaw/agent-messages
```

The old planner-specific path is kept as a compatibility alias:

```txt
POST http://127.0.0.1:4317/openclaw/planner-replies
```

The alias below is also accepted:

```txt
POST http://127.0.0.1:4317/annie/messages
```

Health check:

```txt
GET http://127.0.0.1:4317/health
```

## Where To See The Message

When a message is received, the terminal running `npm run serve` prints:

```txt
[annie-tgs:inbound] received OpenClaw message path=/openclaw/messages summary=...
[annie-tgs:inbound] persisted .annie/inbound/openclaw-messages.jsonl
[annie-tgs:intent] created intent_id=... goal="创建一个网站" path=.annie/intents/intent_....json
[annie-tgs:planner] handed off intent_id=... to=<planner-agent-id> status=delivered inbox=.annie/workflows/<intent_id>/mailboxes/<planner-agent-id>/inbox.jsonl
```

When an agent message is received, the terminal prints:

```txt
[annie-tgs:agent-message] received from=<agent-id> intent_id=<intent_id> type=REQUIREMENT_CLARIFICATION_REQUEST questions=5 inbox=.annie/workflows/<intent_id>/mailboxes/annie/inbox.jsonl
```

The persisted JSONL log is:

```txt
.annie/inbound/openclaw-messages.jsonl
```

The created workflow intent is written under:

```txt
.annie/intents/<intent_id>.json
```

The planner request mailbox entry is written under:

```txt
.annie/workflows/<intent_id>/mailboxes/<planner-agent-id>/inbox.jsonl
```

The agent clarification request for Annie is written under:

```txt
.annie/workflows/<intent_id>/mailboxes/annie/inbox.jsonl
```

Each line contains:

```json
{
  "received_at": "2026-04-30T00:00:00.000Z",
  "source": "openclaw",
  "path": "/openclaw/messages",
  "payload": {}
}
```

Each intent file contains:

```json
{
  "intent_id": "intent_...",
  "goal": "创建一个网站",
  "source": "openclaw",
  "status": "received",
  "created_at": "...",
  "raw_message_ref": {
    "inbound_log_path": ".annie/inbound/openclaw-messages.jsonl",
    "received_at": "..."
  },
  "payload": {}
}
```

## Manual Curl Test

```txt
curl -sS -X POST http://127.0.0.1:4317/openclaw/messages \
  -H 'content-type: application/json' \
  -d '{"type":"USER_MESSAGE","from":"openclaw","to":"annie","message":"创建一个网站"}'
```

Expected response:

```json
{
  "ok": true,
  "received_at": "...",
  "log_path": ".annie/inbound/openclaw-messages.jsonl",
  "intent_id": "intent_...",
  "intent_path": ".annie/intents/intent_....json",
  "planner_agent_id": "<planner-agent-id>",
  "planner_delivery_status": "delivered",
  "planner_inbox_path": ".annie/workflows/<intent_id>/mailboxes/<planner-agent-id>/inbox.jsonl",
  "planning_message_id": "msg_..."
}
```

## Manual Agent Message Test

After a real agent asks clarification questions, post that reply back:

```txt
curl -sS -X POST http://127.0.0.1:4317/openclaw/agent-messages \
  -H 'content-type: application/json' \
  -d '{
    "intent_id":"intent_20260429195002_创建一个网站_ds5hzo",
    "from":"develop-team",
    "message":"网站类型 — 是什么网站？\n技术栈偏好 — 有指定的前端框架或后端技术吗？\n目标受众 — 主要给谁看？\n功能需求 — 需要哪些核心功能？\n现有资源 — 有设计稿、域名、服务器、代码仓库吗？"
  }'
```

Expected response:

```json
{
  "ok": true,
  "received_at": "...",
  "intent_id": "intent_...",
  "from": "develop-team",
  "to": "annie",
  "message_type": "REQUIREMENT_CLARIFICATION_REQUEST",
  "classification": "requirement_clarification_request",
  "agent_message_id": "msg_...",
  "delivery_status": "delivered",
  "clarification_message_id": "msg_...",
  "clarification_delivery_status": "delivered",
  "question_count": 5,
  "inbox_path": ".annie/workflows/<intent_id>/mailboxes/annie/inbox.jsonl",
  "annie_inbox_path": ".annie/workflows/<intent_id>/mailboxes/annie/inbox.jsonl"
}
```

This step verifies inbound delivery into TaskGraphScheduler, creation of a workflow intent, handoff to the local planner mailbox, optional delivery to a real OpenClaw planner agent, and generic agent message intake. It does not yet parse TaskDagPlan, generate a DAG, or dispatch execution tasks.
