import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createMailboxStore } from "../src/communication/mailbox_store.js";
import { createNodeRegistry } from "../src/node_registry/index.js";
import { createStateStore } from "../src/storage/state_store.js";
import { scheduleNextWorkflowWave } from "../src/workflow_scheduling/index.js";
import { dispatchWorkflowWave } from "../src/workflow_dispatch/index.js";
import { createInitialWorkflowState, loadPlan } from "../src/validation/plan_loader.js";

async function seedScheduledWorkflow(rootDir: string): Promise<void> {
  const state = createInitialWorkflowState("wf_dispatch", loadPlan({
    plan_id: "plan_dispatch",
    plan_type: "dag",
    execution_policy: {},
    tasks: [
      {
        id: "T1",
        title: "Build frontend",
        required_capabilities: ["frontend"],
        preferred_agent: "frontend-agent"
      }
    ]
  }), "2026-05-02T00:00:00.000Z");
  await createStateStore(rootDir).saveState(state);
  await scheduleNextWorkflowWave({
    workflow_id: "wf_dispatch"
  }, {
    rootDir,
    now: "2026-05-02T01:00:00.000Z"
  });
}

async function seedNode(rootDir: string): Promise<void> {
  await createNodeRegistry(rootDir).registerProposal({
    schema_version: "node-registration.v1",
    nodes: [
      {
        node_id: "frontend-agent",
        node_type: "individual",
        declared_capabilities: ["frontend"],
        requested_actions: ["send_message"]
      }
    ]
  }, {
    now: "2026-05-02T00:30:00.000Z"
  });
}

test("dispatchWorkflowWave sends assignment to node inbox and marks task assigned", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "annie-workflow-dispatch-"));
  await seedScheduledWorkflow(rootDir);
  await seedNode(rootDir);

  const result = await dispatchWorkflowWave({
    workflow_id: "wf_dispatch"
  }, {
    rootDir,
    now: "2026-05-02T02:00:00.000Z"
  });

  assert.equal(result.decision.status, "dispatched");
  assert.equal(result.assignments.length, 1);
  assert.equal(result.assignments[0]?.task_id, "T1");
  assert.equal(result.assignments[0]?.node_id, "frontend-agent");
  assert.equal(result.state.tasks.T1?.status, "assigned");
  assert.equal(result.state.tasks.T1?.assigned_to, "frontend-agent");
  assert.equal(result.state.tasks.T1?.started_at, null);

  const inbox = await createMailboxStore(rootDir).readMessages("wf_dispatch", "frontend-agent", "inbox");
  assert.equal(inbox.length, 1);
  assert.equal(inbox[0]?.type, "TASK_ASSIGNED");
  assert.equal(inbox[0]?.from, "orchestrator");
  assert.equal(inbox[0]?.to, "frontend-agent");
  assert.equal(inbox[0]?.requires_ack, true);
});

test("dispatchWorkflowWave does not duplicate assignment messages on retry", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "annie-workflow-dispatch-retry-"));
  await seedScheduledWorkflow(rootDir);
  await seedNode(rootDir);

  await dispatchWorkflowWave({
    workflow_id: "wf_dispatch"
  }, {
    rootDir,
    now: "2026-05-02T02:00:00.000Z"
  });
  const second = await dispatchWorkflowWave({
    workflow_id: "wf_dispatch"
  }, {
    rootDir,
    now: "2026-05-02T02:01:00.000Z"
  });

  assert.equal(second.decision.status, "already_dispatched");
  assert.deepEqual(second.decision.already_dispatched_task_ids, ["T1"]);
  assert.equal(second.assignments.length, 0);

  const inbox = await createMailboxStore(rootDir).readMessages("wf_dispatch", "frontend-agent", "inbox");
  assert.equal(inbox.length, 1);
});

test("dispatchWorkflowWave returns rejection when no eligible node exists", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "annie-workflow-dispatch-reject-"));
  await seedScheduledWorkflow(rootDir);

  const result = await dispatchWorkflowWave({
    workflow_id: "wf_dispatch"
  }, {
    rootDir,
    now: "2026-05-02T02:00:00.000Z"
  });

  assert.equal(result.decision.status, "no_dispatchable_tasks");
  assert.deepEqual(result.decision.rejected_task_ids, ["T1"]);
  assert.equal(result.rejections[0]?.code, "NO_ELIGIBLE_NODE");
  assert.equal(result.state.tasks.T1?.status, "ready");
});
