import test from "node:test";
import assert from "node:assert/strict";
import { resolveDependencies } from "../src/scheduler/dependency_resolver.js";
import { createInitialWorkflowState, loadPlan } from "../src/validation/plan_loader.js";

const plan = {
  plan_id: "plan_dependency_test",
  plan_type: "dag",
  execution_policy: {},
  tasks: [
    { id: "T1", title: "Root" },
    { id: "T2", title: "Child", depends_on: ["T1"] },
    { id: "T3", title: "Grandchild", depends_on: ["T2"] }
  ]
} as const;

test("marks no-dependency pending tasks as ready", () => {
  const state = createInitialWorkflowState("wf_dependency_test", loadPlan(plan));
  const resolved = resolveDependencies(state);

  assert.equal(resolved.state.tasks.T1?.status, "ready");
  assert.deepEqual(resolved.ready_task_ids, ["T1"]);
  assert.deepEqual(resolved.status_changes.map((change) => change.task_id), ["T1"]);
});

test("marks downstream task ready after all dependencies are done", () => {
  const state = createInitialWorkflowState("wf_dependency_test", loadPlan(plan));
  state.tasks.T1!.status = "done";

  const resolved = resolveDependencies(state);

  assert.equal(resolved.state.tasks.T2?.status, "ready");
  assert.deepEqual(resolved.ready_task_ids, ["T2"]);
});

test("blocks downstream task when dependency failed", () => {
  const state = createInitialWorkflowState("wf_dependency_test", loadPlan(plan));
  state.tasks.T1!.status = "failed";

  const resolved = resolveDependencies(state);

  assert.equal(resolved.state.tasks.T2?.status, "blocked");
  assert.deepEqual(resolved.blocked_task_ids, ["T2", "T3"]);
  assert.match(resolved.state.tasks.T2?.blocked_reason ?? "", /T1/);
  assert.match(resolved.state.tasks.T3?.blocked_reason ?? "", /T2/);
});

test("does not mutate the original workflow state", () => {
  const state = createInitialWorkflowState("wf_dependency_test", loadPlan(plan));
  const resolved = resolveDependencies(state);

  assert.notEqual(resolved.state, state);
  assert.equal(state.tasks.T1?.status, "pending");
  assert.equal(resolved.state.tasks.T1?.status, "ready");
});
