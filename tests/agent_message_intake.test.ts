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
import { TaskGraphSchedulerError } from "../src/errors.js";

const replyText = `网站类型 — 是什么网站？
技术栈偏好 — 有指定的前端框架或后端技术吗？`;

test("parseAgentMessagePayload accepts generic agent message fields", () => {
  const parsed = parseAgentMessagePayload({
    workflow_id: "intent_001",
    agent_id: "develop-team",
    target: "annie",
    content: "需要确认网站类型？"
  });

  assert.equal(parsed.intent_id, "intent_001");
  assert.equal(parsed.from, "develop-team");
  assert.equal(parsed.to, "annie");
  assert.equal(parsed.text, "需要确认网站类型？");
});

test("parseAgentMessagePayload defaults target to Annie", () => {
  const parsed = parseAgentMessagePayload({
    intent_id: "intent_001",
    from: "develop-team",
    text: "需要确认网站类型？"
  });

  assert.equal(parsed.to, "annie");
});

test("parseAgentMessagePayload rejects missing text", () => {
  assert.throws(
    () => parseAgentMessagePayload({
      intent_id: "intent_001",
      from: "develop-team"
    }),
    (error) => error instanceof TaskGraphSchedulerError
      && error.code === "AGENT_MESSAGE_TEXT_REQUIRED"
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
    to: "annie",
    message: replyText
  }, {
    rootDir,
    now: "2026-05-01T00:00:00.000Z"
  });

  assert.equal(result.classification, "requirement_clarification_request");
  assert.equal(result.message.type, "REQUIREMENT_CLARIFICATION_REQUEST");
  assert.equal(result.message.from, "develop-team");
  assert.equal(result.message.to, "annie");
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
