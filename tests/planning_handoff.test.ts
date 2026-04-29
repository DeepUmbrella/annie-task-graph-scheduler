import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createMailboxStore } from "../src/communication/mailbox_store.js";
import { handoffIntentToPlanner } from "../src/planning/index.js";
import { createDefaultTeamSnapshot } from "../src/team/index.js";
import type { WorkflowIntent } from "../src/intake/index.js";

test("handoffIntentToPlanner writes planning request to controller mailbox", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "annie-tgs-planner-handoff-"));
  const team = createDefaultTeamSnapshot("2026-04-30T00:00:00.000Z");
  const intent: WorkflowIntent = {
    intent_id: "intent_create_site",
    goal: "创建一个网站",
    source: "openclaw",
    status: "received",
    created_at: "2026-04-30T00:01:00.000Z",
    raw_message_ref: {
      inbound_log_path: join(rootDir, "inbound", "openclaw-messages.jsonl"),
      received_at: "2026-04-30T00:01:00.000Z"
    },
    payload: {
      message: "创建一个网站"
    }
  };

  const result = await handoffIntentToPlanner(intent, team, {
    rootDir,
    now: "2026-04-30T00:02:00.000Z"
  });

  assert.equal(result.planner_agent_id, "team-lead-agent");
  assert.equal(result.message.type, "PLANNING_REQUEST");
  assert.equal(result.message.status, "delivered");
  assert.equal(result.message.to, "team-lead-agent");
  assert.equal(result.message.payload.intent_id, "intent_create_site");
  assert.equal(result.message.payload.goal, "创建一个网站");

  const mailboxStore = createMailboxStore(rootDir);
  const inbox = await mailboxStore.readMessages("intent_create_site", "team-lead-agent", "inbox");
  const outbox = await mailboxStore.readMessages("intent_create_site", "orchestrator", "outbox");

  assert.equal(inbox.length, 1);
  assert.equal(inbox[0]?.type, "PLANNING_REQUEST");
  assert.equal(inbox[0]?.payload.required_output, "TaskDagPlan");
  assert.equal(outbox.length, 1);
  assert.equal(outbox[0]?.status, "queued");
});
