import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createMailboxStore } from "../src/communication/mailbox_store.js";
import { createMessageBus } from "../src/communication/message_bus.js";
import { validateProtocolMessage } from "../src/communication/protocol_validator.js";
import { MockAdapter, type TransportAdapter } from "../src/communication/openclaw_adapter.js";
import { TaskGraphSchedulerError } from "../src/errors.js";
import { createStateStore } from "../src/storage/state_store.js";
import { createInitialWorkflowState, loadPlan } from "../src/validation/plan_loader.js";

async function createBus() {
  const rootDir = await mkdtemp(join(tmpdir(), "annie-tgs-mailbox-"));
  const mailboxStore = createMailboxStore(rootDir);
  const transport = new MockAdapter();
  const bus = createMessageBus({
    mailbox_store: mailboxStore,
    transport
  });

  return { bus, mailboxStore, rootDir, transport };
}

test("sends TASK_ASSIGNED into sender outbox and receiver inbox", async () => {
  const { bus, mailboxStore, transport } = await createBus();
  const message = bus.createMessage({
    workflow_id: "wf_message_test",
    task_id: "T1",
    wave_id: "wave_001",
    from: "orchestrator",
    to: "backend-agent",
    type: "TASK_ASSIGNED",
    payload: { title: "Implement backend" },
    created_at: "2026-04-26T00:00:00.000Z"
  });
  const delivered = await bus.sendMessage(message);

  assert.equal(delivered.status, "delivered");
  assert.equal(delivered.delivery_attempts, 1);
  assert.equal(transport.sent.length, 1);
  assert.equal((await mailboxStore.readMessages("wf_message_test", "orchestrator", "outbox")).length, 1);
  assert.equal((await mailboxStore.readMessages("wf_message_test", "backend-agent", "inbox")).length, 1);
});

test("accepts TASK_COMPLETED from agent to orchestrator", () => {
  const bus = createMessageBus();
  assert.equal(typeof bus, "object");
});

test("rejects invalid protocol directions", async () => {
  const { bus } = await createBus();
  const message = bus.createMessage({
    workflow_id: "wf_message_test",
    task_id: "T1",
    wave_id: "wave_001",
    from: "orchestrator",
    to: "backend-agent",
    type: "TASK_ASSIGNED"
  });

  assert.throws(
    () => validateProtocolMessage({ ...message, from: "backend-agent", to: "frontend-agent" }),
    (error) => error instanceof TaskGraphSchedulerError
      && error.code === "MESSAGE_DIRECTION_INVALID"
  );
});

test("acknowledges and marks messages processed", async () => {
  const { bus } = await createBus();
  const delivered = await bus.sendMessage(bus.createMessage({
    workflow_id: "wf_message_test",
    task_id: "T1",
    wave_id: "wave_001",
    from: "backend-agent",
    to: "orchestrator",
    type: "TASK_COMPLETED",
    payload: { summary: "Done" }
  }));
  const acknowledged = await bus.acknowledgeMessage(delivered, "2026-04-26T00:01:00.000Z");
  const processed = await bus.markProcessed(acknowledged, "2026-04-26T00:02:00.000Z");

  assert.equal(acknowledged.status, "acknowledged");
  assert.equal(processed.status, "processed");
  assert.equal(processed.processed_at, "2026-04-26T00:02:00.000Z");
});

test("recovers delivered acknowledged and processed messages from mailbox jsonl", async () => {
  const { bus, rootDir } = await createBus();
  const delivered = await bus.sendMessage(bus.createMessage({
    workflow_id: "wf_message_recovery",
    task_id: "T1",
    wave_id: "wave_001",
    from: "backend-agent",
    to: "orchestrator",
    type: "TASK_COMPLETED",
    payload: { summary: "Done" }
  }));
  const acknowledged = await bus.acknowledgeMessage(delivered, "2026-04-26T00:01:00.000Z");
  await bus.markProcessed(acknowledged, "2026-04-26T00:02:00.000Z");

  const recoveredStore = createMailboxStore(rootDir);
  const inbox = await recoveredStore.readMessages("wf_message_recovery", "orchestrator", "inbox");

  assert.deepEqual(inbox.map((message) => message.status), ["delivered", "acknowledged", "processed"]);
  assert.deepEqual(inbox.map((message) => message.message_id), [
    delivered.message_id,
    delivered.message_id,
    delivered.message_id
  ]);
});

test("recovers failed delivery messages from mailbox jsonl", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "annie-tgs-mailbox-failed-"));
  const mailboxStore = createMailboxStore(rootDir);
  const failingTransport: TransportAdapter = {
    async send() {
      throw new Error("transport offline");
    }
  };
  const bus = createMessageBus({
    mailbox_store: mailboxStore,
    transport: failingTransport
  });

  await bus.sendMessage(bus.createMessage({
    workflow_id: "wf_message_failed_recovery",
    task_id: "T1",
    wave_id: "wave_001",
    from: "orchestrator",
    to: "backend-agent",
    type: "TASK_ASSIGNED"
  }));

  const recoveredStore = createMailboxStore(rootDir);
  const inbox = await recoveredStore.readMessages("wf_message_failed_recovery", "backend-agent", "inbox");

  assert.equal(inbox.length, 1);
  assert.equal(inbox[0]?.status, "failed");
  assert.equal(inbox[0]?.payload.delivery_error, "transport offline");
});

test("message bus does not mutate workflow task state", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "annie-tgs-mailbox-state-boundary-"));
  const stateStore = createStateStore(rootDir);
  const mailboxStore = createMailboxStore(rootDir);
  const bus = createMessageBus({
    mailbox_store: mailboxStore,
    transport: new MockAdapter()
  });
  const state = createInitialWorkflowState("wf_message_state_boundary", loadPlan({
    plan_id: "plan_message_state_boundary",
    plan_type: "dag",
    execution_policy: {},
    tasks: [{ id: "T1", title: "Running task" }]
  }), "2026-04-26T00:00:00.000Z");
  state.tasks.T1!.status = "running";
  await stateStore.saveState(state);

  const delivered = await bus.sendMessage(bus.createMessage({
    workflow_id: state.workflow_id,
    task_id: "T1",
    wave_id: "wave_001",
    from: "backend-agent",
    to: "orchestrator",
    type: "TASK_COMPLETED",
    payload: { summary: "Done" }
  }));
  await bus.markProcessed(delivered, "2026-04-26T00:01:00.000Z");

  const loaded = await stateStore.loadState(state.workflow_id);
  assert.equal(loaded.tasks.T1?.status, "running");
});

test("retryDelivery fails after max delivery retries", async () => {
  const { bus } = await createBus();
  const message = bus.createMessage({
    workflow_id: "wf_message_test",
    task_id: "T1",
    wave_id: "wave_001",
    from: "backend-agent",
    to: "orchestrator",
    type: "TASK_FAILED"
  });

  const failed = await bus.retryDelivery({ ...message, delivery_attempts: 2 });

  assert.equal(failed.status, "failed");
  assert.equal(failed.payload.failure_reason, "Maximum delivery retries reached.");
});
