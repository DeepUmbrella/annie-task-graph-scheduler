import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { inboundLogPath, receiveInboundPayload } from "../src/server/inbound_server.js";
import { createPlannerTeamSnapshot } from "../src/team/index.js";
import type { TransportAdapter } from "../src/communication/openclaw_adapter.js";
import type { Message } from "../src/models/message.js";

test("receiveInboundPayload writes OpenClaw messages to the inbound log", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "annie-tgs-inbound-"));
  const logPath = inboundLogPath(rootDir);

  const record = await receiveInboundPayload({
    type: "USER_MESSAGE",
    from: "openclaw",
    to: "annie",
    message: "Create a website"
  }, {
    logPath,
    rootDir,
    path: "/openclaw/messages",
    now: () => "2026-04-28T12:00:00.000Z"
  });

  assert.equal(record.received_at, "2026-04-28T12:00:00.000Z");
  assert.equal(record.path, "/openclaw/messages");
  assert.equal(record.intent.goal, "Create a website");
  assert.equal(record.intent.raw_message_ref.inbound_log_path, logPath);
  assert.equal(record.planner_handoff.planner_agent_id, "team-lead-agent");
  assert.equal(record.planner_handoff.message.type, "PLANNING_REQUEST");
  assert.equal(record.planner_handoff.message.status, "delivered");
  assert.equal(record.planner_handoff.message.payload.intent_id, record.intent.intent_id);

  const rawLog = await readFile(logPath, "utf8");
  const records = rawLog
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as {
      received_at: string;
      source: string;
      path: string;
      payload: { message: string };
    });

  assert.equal(records.length, 1);
  assert.equal(records[0]?.received_at, "2026-04-28T12:00:00.000Z");
  assert.equal(records[0]?.source, "openclaw");
  assert.equal(records[0]?.path, "/openclaw/messages");
  assert.equal(records[0]?.payload.message, "Create a website");

  const intent = JSON.parse(await readFile(record.intent_path, "utf8")) as {
    intent_id: string;
    goal: string;
  };
  assert.equal(intent.intent_id, record.intent.intent_id);
  assert.equal(intent.goal, "Create a website");

  const plannerInboxRaw = await readFile(record.planner_handoff.planner_inbox_path, "utf8");
  const plannerMessages = plannerInboxRaw
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as { type: string; payload: { goal: string } });
  assert.equal(plannerMessages.length, 1);
  assert.equal(plannerMessages[0]?.type, "PLANNING_REQUEST");
  assert.equal(plannerMessages[0]?.payload.goal, "Create a website");
});

test("receiveInboundPayload can hand off planning requests through injected OpenClaw transport", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "annie-tgs-inbound-openclaw-"));
  const logPath = inboundLogPath(rootDir);
  const sent: Message[] = [];
  const transport: TransportAdapter = {
    async send(message) {
      sent.push(message);
    }
  };

  const record = await receiveInboundPayload({
    type: "USER_MESSAGE",
    from: "openclaw",
    to: "annie",
    message: "Create a website"
  }, {
    logPath,
    rootDir,
    team: createPlannerTeamSnapshot("develop-team", "2026-04-30T00:00:00.000Z"),
    plannerTransport: transport,
    now: () => "2026-04-30T00:00:00.000Z"
  });

  assert.equal(record.planner_handoff.planner_agent_id, "develop-team");
  assert.equal(record.planner_handoff.message.status, "delivered");
  assert.equal(sent.length, 1);
  assert.equal(sent[0]?.to, "develop-team");
  assert.equal(sent[0]?.type, "PLANNING_REQUEST");
  assert.equal(sent[0]?.payload.intent_id, record.intent.intent_id);
});
