import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { inboundLogPath, listRegisteredNodes, receiveAgentMessage, receiveInboundPayload, receiveNodeRegistration } from "../src/server/inbound_server.js";
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

test("receiveAgentMessage writes generic agent message to Annie inbox", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "annie-tgs-agent-message-endpoint-"));
  const record = await receiveAgentMessage({
    intent_id: "intent_002",
    from: "annie-dev",
    action: "send_message",
    to: "annie",
    message_type: "REQUIREMENT_CLARIFICATION_REQUEST",
    message: "范围确认 — 是否需要登录？"
  }, {
    rootDir,
    path: "/agent-messages",
    now: () => "2026-05-01T00:00:00.000Z"
  });

  assert.equal(record.path, "/agent-messages");
  assert.equal(record.agent_message.message.type, "REQUIREMENT_CLARIFICATION_REQUEST");
  assert.equal(record.agent_message.message.workflow_id, "intent_002");
  assert.equal(record.agent_message.message.from, "annie-dev");
  assert.equal(record.agent_message.message.to, "annie");
  assert.equal(record.agent_message.questions.length, 1);

  const inboxRaw = await readFile(record.agent_message.inbox_path, "utf8");
  const inboxMessages = inboxRaw
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as { type: string; from: string; to: string });
  assert.equal(inboxMessages.length, 1);
  assert.equal(inboxMessages[0]?.type, "REQUIREMENT_CLARIFICATION_REQUEST");
  assert.equal(inboxMessages[0]?.from, "annie-dev");
  assert.equal(inboxMessages[0]?.to, "annie");
});

test("receiveNodeRegistration stores runtime-neutral node proposals", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "annie-tgs-node-registration-"));
  const record = await receiveNodeRegistration({
    schema_version: "node-registration.v1",
    nodes: [
      {
        node_id: "develop-team",
        node_type: "team",
        requested_actions: ["send_message"]
      },
      {
        node_id: "annie-dev",
        node_type: "individual",
        requested_actions: ["send_message"]
      }
    ],
    team_compositions: [
      {
        team_node_id: "develop-team",
        lead_node_id: "annie-dev",
        members: [
          {
            node_id: "annie-dev",
            team_role: "lead_developer"
          }
        ]
      }
    ]
  }, {
    rootDir,
    now: () => "2026-05-01T03:00:00.000Z"
  });

  assert.equal(record.path, "/nodes/register");
  assert.equal(record.registered_at, "2026-05-01T03:00:00.000Z");
  assert.equal(record.snapshot.nodes.length, 2);
  assert.equal(record.snapshot.team_compositions.length, 1);
});

test("listRegisteredNodes reads the snapshot used by GET /nodes", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "annie-tgs-node-list-"));
  await receiveNodeRegistration({
    schema_version: "node-registration.v1",
    nodes: [
      {
        node_id: "annie-dev",
        node_type: "individual",
        requested_actions: ["send_message"]
      }
    ]
  }, {
    rootDir,
    now: () => "2026-05-01T04:00:00.000Z"
  });

  const snapshot = await listRegisteredNodes({ rootDir });

  assert.equal(snapshot.nodes.length, 1);
  assert.equal(snapshot.nodes[0]?.node_id, "annie-dev");
  assert.equal(snapshot.team_compositions.length, 0);
});
