import test from "node:test";
import assert from "node:assert/strict";
import { validateDag } from "../src/validation/dag_validator.js";
import { createInitialWorkflowState, loadPlan, normalizeExecutionPolicy } from "../src/validation/plan_loader.js";

const validPlan = {
  plan_id: "plan_valid",
  plan_type: "dag",
  execution_policy: {
    max_parallel_tasks: 3
  },
  tasks: [
    {
      id: "T1",
      title: "Define protocol",
      depends_on: []
    },
    {
      id: "T2",
      title: "Implement backend",
      depends_on: ["T1"]
    },
    {
      id: "T3",
      title: "Implement frontend",
      depends_on: ["T1"]
    },
    {
      id: "T4",
      title: "Integration test",
      depends_on: ["T2", "T3"]
    }
  ]
} as const;

test("validates a legal DAG and returns topological order", () => {
  const result = validateDag(validPlan);

  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
  assert.equal(result.topological_order[0], "T1");
  assert.equal(result.topological_order.at(-1), "T4");
  assert.equal(new Set(result.topological_order).size, validPlan.tasks.length);
});

test("rejects a non-dag plan", () => {
  const result = validateDag({
    ...validPlan,
    plan_type: "linear"
  });

  assert.equal(result.valid, false);
  assert.match(result.errors.join("\n"), /plan_type/);
});

test("rejects an empty task list", () => {
  const result = validateDag({
    ...validPlan,
    tasks: []
  });

  assert.equal(result.valid, false);
  assert.match(result.errors.join("\n"), /must not be empty/);
});

test("rejects duplicate task ids", () => {
  const result = validateDag({
    ...validPlan,
    tasks: [
      { id: "T1", title: "One" },
      { id: "T1", title: "Duplicate" }
    ]
  });

  assert.equal(result.valid, false);
  assert.match(result.errors.join("\n"), /Duplicate task id: T1/);
});

test("rejects missing dependency references", () => {
  const result = validateDag({
    ...validPlan,
    tasks: [
      { id: "T1", title: "One", depends_on: ["UNKNOWN"] }
    ]
  });

  assert.equal(result.valid, false);
  assert.match(result.errors.join("\n"), /depends on missing task UNKNOWN/);
});

test("rejects cyclic dependencies", () => {
  const result = validateDag({
    ...validPlan,
    tasks: [
      { id: "T1", title: "One", depends_on: ["T2"] },
      { id: "T2", title: "Two", depends_on: ["T1"] }
    ]
  });

  assert.equal(result.valid, false);
  assert.match(result.errors.join("\n"), /contains a cycle/);
});

test("loadPlan merges default execution policy", () => {
  const loaded = loadPlan(validPlan);

  assert.equal(loaded.execution_policy.max_parallel_tasks, 3);
  assert.equal(loaded.execution_policy.max_agents, 3);
  assert.equal(loaded.execution_policy.max_delivery_retries, 2);
  assert.equal(loaded.execution_policy.scheduling.selection_order, "topological");
  assert.equal(loaded.execution_policy.agents.fallback_agent, "default-agent");
  assert.equal(loaded.execution_policy.conflicts.mode, "exact");
});

test("normalizeExecutionPolicy deeply merges phase 02 policy defaults", () => {
  const policy = normalizeExecutionPolicy({
    scheduling: {
      selection_order: "risk_aware",
      prefer_low_risk_first: true,
      explain_skipped_tasks: true
    },
    risk: {
      high_risk_parallel_limit: 2,
      critical_requires_review: true,
      scoring_weights: {
        explicit_risk: 20
      }
    },
    retry: {
      max_retries: 3,
      retry_on: ["transient", "permission"],
      manual_review_on_second_failure: false,
      backoff: "linear"
    }
  });

  assert.equal(policy.scheduling.selection_order, "risk_aware");
  assert.equal(policy.risk.high_risk_parallel_limit, 2);
  assert.equal(policy.risk.scoring_weights.explicit_risk, 20);
  assert.equal(policy.risk.scoring_weights.expected_files_count, 1);
  assert.equal(policy.retry.max_retries, 3);
  assert.equal(policy.max_retries, 3);
  assert.deepEqual(policy.retry_on, ["transient", "permission"]);
});

test("createInitialWorkflowState normalizes plan tasks", () => {
  const loaded = loadPlan(validPlan);
  const state = createInitialWorkflowState("wf_test", loaded, "2026-04-26T00:00:00.000Z");

  assert.equal(state.workflow_id, "wf_test");
  assert.equal(state.plan_id, "plan_valid");
  assert.equal(state.tasks.T1?.status, "pending");
  assert.equal(state.tasks.T1?.risk, "low");
  assert.deepEqual(state.tasks.T1?.changed_files, []);
});
