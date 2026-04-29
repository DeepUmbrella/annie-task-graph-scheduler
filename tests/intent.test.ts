import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createWorkflowIntentFromInboundPayload } from "../src/intake/index.js";
import { TaskGraphSchedulerError } from "../src/errors.js";

test("createWorkflowIntentFromInboundPayload extracts goal and persists intent", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "annie-tgs-intent-"));
  const created = await createWorkflowIntentFromInboundPayload({
    type: "USER_MESSAGE",
    message: "创建一个网站"
  }, {
    rootDir,
    inboundLogPath: join(rootDir, "inbound", "openclaw-messages.jsonl"),
    receivedAt: "2026-04-30T00:00:00.000Z",
    now: "2026-04-30T00:00:00.000Z"
  });

  assert.match(created.intent.intent_id, /^intent_20260430000000_创建一个网站_/);
  assert.equal(created.intent.goal, "创建一个网站");
  assert.equal(created.intent.status, "received");
  assert.equal(created.intent.source, "openclaw");
  assert.equal(created.intent.raw_message_ref.received_at, "2026-04-30T00:00:00.000Z");

  const persisted = JSON.parse(await readFile(created.path, "utf8")) as {
    intent_id: string;
    goal: string;
  };
  assert.equal(persisted.intent_id, created.intent.intent_id);
  assert.equal(persisted.goal, "创建一个网站");
});

test("createWorkflowIntentFromInboundPayload rejects payloads without a goal", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "annie-tgs-intent-invalid-"));

  await assert.rejects(
    () => createWorkflowIntentFromInboundPayload({
      type: "PING"
    }, {
      rootDir,
      inboundLogPath: join(rootDir, "inbound", "openclaw-messages.jsonl"),
      receivedAt: "2026-04-30T00:00:00.000Z"
    }),
    (error) => error instanceof TaskGraphSchedulerError
      && error.code === "INTENT_GOAL_MISSING"
  );
});
