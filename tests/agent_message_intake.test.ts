import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  extractClarificationQuestions,
  intakeAgentMessage,
  parseAgentMessagePayload
} from "../src/agent_message/index.js";
import { buildAgentActionPolicyFromNodeRegistry, normalizeNodeRegistrationProposal } from "../src/node_registry/index.js";
import type { AgentActionPolicy } from "../src/agent_action/index.js";
import { TaskGraphSchedulerError } from "../src/errors.js";

const replyText = `网站类型 — 是什么网站？
技术栈偏好 — 有指定的前端框架或后端技术吗？`;

test("parseAgentMessagePayload accepts generic agent message fields", () => {
  const parsed = parseAgentMessagePayload({
    workflow_id: "intent_001",
    agent_id: "develop-team",
    action: "send_message",
    target: "annie",
    message_type: "REQUIREMENT_CLARIFICATION_REQUEST",
    content: "需要确认网站类型？"
  });

  assert.equal(parsed.intent_id, "intent_001");
  assert.equal(parsed.from, "develop-team");
  assert.equal(parsed.action, "send_message");
  assert.equal(parsed.to, "annie");
  assert.equal(parsed.message_type, "REQUIREMENT_CLARIFICATION_REQUEST");
  assert.equal(parsed.text, "需要确认网站类型？");
});

test("parseAgentMessagePayload rejects missing text", () => {
  assert.throws(
    () => parseAgentMessagePayload({
      intent_id: "intent_001",
      from: "develop-team",
      action: "send_message",
      to: "annie",
      message_type: "REQUIREMENT_CLARIFICATION_REQUEST"
    }),
    (error) => error instanceof TaskGraphSchedulerError
      && error.code === "AGENT_MESSAGE_TEXT_REQUIRED"
  );
});

test("parseAgentMessagePayload rejects missing action", () => {
  assert.throws(
    () => parseAgentMessagePayload({
      intent_id: "intent_001",
      from: "develop-team",
      to: "annie",
      message_type: "REQUIREMENT_CLARIFICATION_REQUEST",
      text: "需要确认网站类型？"
    }),
    (error) => error instanceof TaskGraphSchedulerError
      && error.code === "AGENT_MESSAGE_ACTION_REQUIRED"
  );
});

test("parseAgentMessagePayload rejects missing explicit target", () => {
  assert.throws(
    () => parseAgentMessagePayload({
      intent_id: "intent_001",
      from: "develop-team",
      action: "send_message",
      message_type: "REQUIREMENT_CLARIFICATION_REQUEST",
      text: "需要确认网站类型？"
    }),
    (error) => error instanceof TaskGraphSchedulerError
      && error.code === "AGENT_MESSAGE_TO_REQUIRED"
  );
});

test("extractClarificationQuestions supports labeled questions", () => {
  assert.deepEqual(extractClarificationQuestions(replyText), [
    "是什么网站？",
    "有指定的前端框架或后端技术吗？"
  ]);
});

test("intakeAgentMessage writes generic clarification request to target inbox", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "annie-tgs-agent-message-"));
  const result = await intakeAgentMessage({
    intent_id: "intent_001",
    from: "develop-team",
    runtime: "openclaw",
    action: "send_message",
    to: "annie",
    message_type: "REQUIREMENT_CLARIFICATION_REQUEST",
    message: replyText
  }, {
    rootDir,
    now: "2026-05-01T00:00:00.000Z"
  });

  assert.equal(result.classification, "requirement_clarification_request");
  assert.equal(result.message.type, "REQUIREMENT_CLARIFICATION_REQUEST");
  assert.equal(result.message.from, "develop-team");
  assert.equal(result.message.to, "annie");
  assert.equal(result.message.payload.action, "send_message");
  assert.equal(result.message.payload.runtime, "openclaw");
  assert.equal(result.questions.length, 2);

  const inboxRaw = await readFile(result.inbox_path, "utf8");
  const inboxMessages = inboxRaw
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as { type: string; payload: { classification: string } });
  assert.equal(inboxMessages.length, 1);
  assert.equal(inboxMessages[0]?.type, "REQUIREMENT_CLARIFICATION_REQUEST");
  assert.equal(inboxMessages[0]?.payload.classification, "requirement_clarification_request");
});

test("intakeAgentMessage rejects actions not allowed by policy", async () => {
  const policy: AgentActionPolicy = {
    policy_id: "test-policy",
    source: "configured",
    nodes: [
      {
        node_id: "develop-team",
        permissions: []
      }
    ]
  };

  await assert.rejects(
    () => intakeAgentMessage({
      intent_id: "intent_001",
      from: "develop-team",
      action: "send_message",
      to: "annie",
      message_type: "REQUIREMENT_CLARIFICATION_REQUEST",
      message: replyText
    }, {
      actionPolicy: policy
    }),
    (error) => error instanceof TaskGraphSchedulerError
      && error.code === "AGENT_ACTION_NOT_ALLOWED"
  );
});

test("intakeAgentMessage accepts policy derived from node registry", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "annie-tgs-agent-message-registry-policy-"));
  const snapshot = normalizeNodeRegistrationProposal({
    schema_version: "node-registration.v1",
    nodes: [
      {
        node_id: "annie-dev",
        node_type: "individual",
        requested_actions: ["send_message"]
      }
    ]
  }, "2026-05-01T00:00:00.000Z");
  const policy = buildAgentActionPolicyFromNodeRegistry(snapshot);

  const result = await intakeAgentMessage({
    intent_id: "intent_003",
    from: "annie-dev",
    action: "send_message",
    to: "annie",
    message_type: "REQUIREMENT_CLARIFICATION_REQUEST",
    message: replyText
  }, {
    rootDir,
    actionPolicy: policy
  });

  assert.equal(result.message.from, "annie-dev");
  assert.equal(result.message.to, "annie");
});
