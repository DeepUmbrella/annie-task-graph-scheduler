import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createStateStore, isTaskTransitionAllowed } from "../src/storage/state_store.js";
import { createInitialWorkflowState, loadPlan } from "../src/validation/plan_loader.js";
import { TaskGraphSchedulerError } from "../src/errors.js";

const plan = {
  plan_id: "plan_state_store_test",
  plan_type: "dag",
  execution_policy: {},
  tasks: [
    { id: "T1", title: "Root" }
  ]
} as const;

test("saves and loads workflow state", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "annie-tgs-state-"));
  const store = createStateStore(rootDir);
  const state = createInitialWorkflowState("wf_state_store_test", loadPlan(plan), "2026-04-26T00:00:00.000Z");

  await store.saveState(state);
  const loaded = await store.loadState("wf_state_store_test");

  assert.deepEqual(loaded, state);
});

test("appends audit events as jsonl", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "annie-tgs-audit-"));
  const store = createStateStore(rootDir);

  await store.appendAuditEvent({
    event_id: "evt_001",
    workflow_id: "wf_audit_test",
    type: "TASK_STATUS_CHANGED",
    payload: { task_id: "T1", from: "pending", to: "ready" },
    created_at: "2026-04-26T00:00:00.000Z"
  });

  const audit = await readFile(store.auditPath("wf_audit_test"), "utf8");
  assert.equal(audit.trim(), '{"event_id":"evt_001","workflow_id":"wf_audit_test","type":"TASK_STATUS_CHANGED","payload":{"task_id":"T1","from":"pending","to":"ready"},"created_at":"2026-04-26T00:00:00.000Z"}');
});

test("transitionTaskStatus persists state and audit log", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "annie-tgs-transition-"));
  const store = createStateStore(rootDir);
  const state = createInitialWorkflowState("wf_transition_test", loadPlan(plan), "2026-04-26T00:00:00.000Z");

  await store.saveState(state);
  const readyState = await store.transitionTaskStatus(state, "T1", "ready", {
    now: "2026-04-26T00:01:00.000Z",
    reason: "No dependencies."
  });

  assert.equal(readyState.tasks.T1?.status, "ready");

  const loaded = await store.loadState("wf_transition_test");
  assert.equal(loaded.tasks.T1?.status, "ready");

  const audit = await readFile(store.auditPath("wf_transition_test"), "utf8");
  assert.match(audit, /TASK_STATUS_CHANGED/);
  assert.match(audit, /No dependencies/);
});

test("rejects invalid task status transitions", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "annie-tgs-invalid-transition-"));
  const store = createStateStore(rootDir);
  const state = createInitialWorkflowState("wf_invalid_transition_test", loadPlan(plan));

  await assert.rejects(
    () => store.transitionTaskStatus(state, "T1", "running"),
    (error) => error instanceof TaskGraphSchedulerError
      && error.code === "TASK_STATUS_TRANSITION_INVALID"
  );
});

test("allows expected task status transitions", () => {
  assert.equal(isTaskTransitionAllowed("pending", "ready"), true);
  assert.equal(isTaskTransitionAllowed("failed", "done"), false);
  assert.equal(isTaskTransitionAllowed("failed", "done", true), true);
});
