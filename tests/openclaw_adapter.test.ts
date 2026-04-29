import test from "node:test";
import assert from "node:assert/strict";
import {
  OpenClawAdapter,
  OpenClawCliClient,
  toOpenClawAgentArgs,
  toOpenClawEnvelope,
  type OpenClawEnvelope
} from "../src/communication/openclaw_adapter.js";
import type { Message } from "../src/models/message.js";

function createMessage(): Message {
  return {
    message_id: "msg_001",
    workflow_id: "wf_001",
    task_id: "T1",
    wave_id: "wave_001",
    from: "orchestrator",
    to: "backend-agent",
    type: "TASK_ASSIGNED",
    priority: "normal",
    requires_ack: true,
    status: "delivered",
    delivery_attempts: 1,
    created_at: "2026-04-26T00:00:00.000Z",
    acknowledged_at: null,
    processed_at: null,
    payload: {
      title: "Implement backend"
    }
  };
}

test("converts Annie messages to OpenClaw envelopes", () => {
  const envelope = toOpenClawEnvelope(createMessage(), {
    "backend-agent": "session_backend_001"
  });

  assert.equal(envelope.session_id, "session_backend_001");
  assert.equal(envelope.target_agent, "backend-agent");
  assert.deepEqual(JSON.parse(envelope.message), {
    type: "TASK_ASSIGNED",
    payload: {
      title: "Implement backend"
    }
  });
  assert.equal(envelope.metadata.workflow_id, "wf_001");
  assert.equal(envelope.metadata.requires_ack, true);
});

test("OpenClawAdapter delegates transport to injected client", async () => {
  const sent: OpenClawEnvelope[] = [];
  const adapter = new OpenClawAdapter({
    async send(envelope) {
      sent.push(envelope);
    }
  }, {
    agent_sessions: {
      "backend-agent": "session_backend_001"
    }
  });

  await adapter.send(createMessage());

  assert.equal(sent.length, 1);
  assert.equal(sent[0]?.session_id, "session_backend_001");
  assert.equal(sent[0]?.metadata.type, "TASK_ASSIGNED");
});

test("toOpenClawAgentArgs creates CLI args for an agent turn", () => {
  const envelope = toOpenClawEnvelope(createMessage(), {
    "backend-agent": "session_backend_001"
  });

  assert.deepEqual(toOpenClawAgentArgs(envelope, {
    local: true,
    thinking: "medium",
    timeout_seconds: 30
  }), [
    "agent",
    "--agent",
    "backend-agent",
    "--message",
    envelope.message,
    "--json",
    "--session-id",
    "session_backend_001",
    "--local",
    "--thinking",
    "medium",
    "--timeout",
    "30"
  ]);
});

test("OpenClawCliClient invokes injected runner without calling real OpenClaw", async () => {
  const calls: Array<{ command: string; args: string[] }> = [];
  const client = new OpenClawCliClient({
    command: "openclaw-test",
    runner: async (command, args) => {
      calls.push({ command, args });
      return { stdout: "{\"ok\":true}", stderr: "" };
    }
  });

  await client.send(toOpenClawEnvelope(createMessage()));

  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.command, "openclaw-test");
  assert.deepEqual(calls[0]?.args.slice(0, 5), [
    "agent",
    "--agent",
    "backend-agent",
    "--message",
    JSON.stringify({
      type: "TASK_ASSIGNED",
      payload: {
        title: "Implement backend"
      }
    })
  ]);
  assert.ok(calls[0]?.args.includes("--json"));
});
