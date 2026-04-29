import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  extractClarificationQuestions,
  intakePlannerReply,
  parsePlannerReplyPayload
} from "../src/planner_reply/index.js";
import { TaskGraphSchedulerError } from "../src/errors.js";

const replyText = `收到一个网站创建计划请求。

目标： 创建一个网站
意图ID： intent_20260429195002_创建一个网站_ds5hzo
团队： openclaw-develop-team

在开始详细规划之前，我需要了解一些关键信息：

网站类型 — 是什么网站？（官网、博客、管理后台、SaaS、产品展示…）
技术栈偏好 — 有指定的前端框架（Next.js、Vue、Nuxt）或后端技术吗？
目标受众 — 主要给谁看？
功能需求 — 需要哪些核心功能？（登录、内容管理、支付、SEO…）
现有资源 — 有设计稿、域名、服务器、代码仓库吗？`;

test("parsePlannerReplyPayload accepts common planner reply fields", () => {
  const parsed = parsePlannerReplyPayload({
    workflow_id: "intent_001",
    agent_id: "develop-team",
    message: "需要确认网站类型？"
  });

  assert.equal(parsed.intent_id, "intent_001");
  assert.equal(parsed.from, "develop-team");
  assert.equal(parsed.text, "需要确认网站类型？");
});

test("parsePlannerReplyPayload rejects missing text", () => {
  assert.throws(
    () => parsePlannerReplyPayload({
      intent_id: "intent_001",
      from: "develop-team"
    }),
    (error) => error instanceof TaskGraphSchedulerError
      && error.code === "PLANNER_REPLY_TEXT_REQUIRED"
  );
});

test("extractClarificationQuestions extracts natural language questions", () => {
  assert.deepEqual(extractClarificationQuestions(replyText), [
    "是什么网站？（官网、博客、管理后台、SaaS、产品展示…）",
    "有指定的前端框架（Next.js、Vue、Nuxt）或后端技术吗？",
    "主要给谁看？",
    "需要哪些核心功能？（登录、内容管理、支付、SEO…）",
    "有设计稿、域名、服务器、代码仓库吗？"
  ]);
});

test("intakePlannerReply writes clarification request to Annie inbox", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "annie-tgs-planner-reply-"));
  const result = await intakePlannerReply({
    intent_id: "intent_20260429195002_创建一个网站_ds5hzo",
    from: "develop-team",
    text: replyText
  }, {
    rootDir,
    now: "2026-04-30T00:00:00.000Z"
  });

  assert.equal(result.message.type, "REQUIREMENT_CLARIFICATION_REQUEST");
  assert.equal(result.message.from, "develop-team");
  assert.equal(result.message.to, "annie");
  assert.equal(result.message.status, "delivered");
  assert.equal(result.questions.length, 5);

  const inboxRaw = await readFile(result.annie_inbox_path, "utf8");
  const inboxMessages = inboxRaw
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as { type: string; payload: { intent_id: string; questions: string[] } });
  assert.equal(inboxMessages.length, 1);
  assert.equal(inboxMessages[0]?.type, "REQUIREMENT_CLARIFICATION_REQUEST");
  assert.equal(inboxMessages[0]?.payload.intent_id, "intent_20260429195002_创建一个网站_ds5hzo");
  assert.equal(inboxMessages[0]?.payload.questions.length, 5);
});
