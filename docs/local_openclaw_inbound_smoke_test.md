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

Expected startup output includes:

```txt
[annie-tgs:server] listening on http://127.0.0.1:4317
[annie-tgs:server] inbound log file .annie/inbound/openclaw-messages.jsonl
```

## Endpoint

Send OpenClaw/Annie messages to:

```txt
POST http://127.0.0.1:4317/openclaw/messages
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
```

The persisted JSONL log is:

```txt
.annie/inbound/openclaw-messages.jsonl
```

The created workflow intent is written under:

```txt
.annie/intents/<intent_id>.json
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
  "intent_path": ".annie/intents/intent_....json"
}
```

This step verifies inbound delivery into TaskGraphScheduler and creation of a workflow intent. It does not yet trigger planning, DAG generation, or agent dispatch.
