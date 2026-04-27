import test from "node:test";
import assert from "node:assert/strict";
import { createVisualizationModel, exportVisualization } from "../src/visualization/projection.js";
import { createInitialWorkflowState, loadPlan } from "../src/validation/plan_loader.js";

test("creates visualization model for an empty workflow state", () => {
  const state = createInitialWorkflowState("wf_empty_visualization", loadPlan({
    plan_id: "plan_empty_visualization",
    plan_type: "dag",
    execution_policy: {},
    tasks: [
      {
        id: "T1",
        title: "Only task"
      }
    ]
  }), "2026-04-26T00:00:00.000Z");
  const model = createVisualizationModel(state, "2026-04-26T00:01:00.000Z");

  assert.equal(model.workflow.workflow_id, "wf_empty_visualization");
  assert.equal(model.board.task_status_counts.pending, 1);
  assert.equal(model.dag.nodes.length, 1);
  assert.deepEqual(model.dag.edges, []);
  assert.equal(model.generated_at, "2026-04-26T00:01:00.000Z");
});

test("creates visualization model for workflow with dependencies waves agents and failures", () => {
  const state = createInitialWorkflowState("wf_visualization", loadPlan({
    plan_id: "plan_visualization",
    plan_type: "dag",
    execution_policy: {},
    tasks: [
      {
        id: "T1",
        title: "Root"
      },
      {
        id: "T2",
        title: "Failed child",
        depends_on: ["T1"]
      },
      {
        id: "T3",
        title: "Blocked grandchild",
        depends_on: ["T2"]
      }
    ]
  }), "2026-04-26T00:00:00.000Z");
  state.current_wave = "wave_001";
  state.tasks.T1!.status = "done";
  state.tasks.T2!.status = "failed";
  state.tasks.T2!.failure_type = "implementation";
  state.tasks.T2!.failure_reason = "Compile error";
  state.tasks.T3!.status = "blocked";
  state.tasks.T3!.blocked_reason = "Blocked by dependency T2.";
  state.waves.push({
    id: "wave_001",
    tasks: ["T1", "T2"],
    status: "failed",
    started_at: "2026-04-26T00:02:00.000Z",
    completed_at: "2026-04-26T00:03:00.000Z",
    review: null,
    reason: "Test wave",
    skipped_ready_tasks: [
      {
        task_id: "T3",
        reason: "Skipped for test"
      }
    ]
  });
  state.agents["backend-agent"] = {
    agent_id: "backend-agent",
    capabilities: ["backend"],
    active_task_ids: ["T2"],
    max_concurrent_tasks: 2,
    session_id: "session_backend",
    status: "busy"
  };

  const model = createVisualizationModel(state, "2026-04-26T00:04:00.000Z");

  assert.equal(model.board.task_status_counts.done, 1);
  assert.equal(model.board.task_status_counts.failed, 1);
  assert.equal(model.board.task_status_counts.blocked, 1);
  assert.equal(model.board.wave_status_counts.failed, 1);
  assert.equal(model.board.totals.total_tasks, 3);
  assert.equal(model.board.totals.completed_tasks, 1);
  assert.equal(model.board.totals.completion_ratio, 1 / 3);
  assert.equal(model.board.current_wave?.id, "wave_001");
  assert.equal(model.board.current_wave?.completed_task_count, 1);
  assert.deepEqual(model.board.failed_tasks.map((task) => task.task_id), ["T2"]);
  assert.deepEqual(model.board.blocked_tasks.map((task) => task.task_id), ["T3"]);
  assert.deepEqual(model.dag.edges.map((edge) => edge.id), ["T1->T2", "T2->T3"]);
  assert.equal(model.dag.edges[0]?.status, "satisfied");
  assert.equal(model.dag.edges[1]?.status, "blocked");
  assert.equal(model.dag.edges[0]?.label, "T1 -> T2");
  assert.equal(model.dag.edges[1]?.reason, "Dependency failed.");
  assert.deepEqual(model.dag.nodes.map((node) => node.id), ["T1", "T2", "T3"]);
  assert.equal(model.dag.nodes.find((node) => node.id === "T2")?.highlight, "failed");
  assert.equal(model.dag.nodes.find((node) => node.id === "T3")?.highlight, "blocked");
  assert.equal(model.dag.nodes.find((node) => node.id === "T1")?.downstream_count, 1);
  assert.equal((model.dag.nodes.find((node) => node.id === "T2")?.risk_score ?? 0) > 0, true);
  assert.equal(model.waves.current_wave, "wave_001");
  assert.equal(model.waves.waves[0]?.id, "wave_001");
  assert.equal(model.waves.total_waves, 1);
  assert.equal(model.waves.completed_waves, 0);
  assert.equal(model.waves.waves[0]?.is_current, true);
  assert.equal(model.waves.waves[0]?.task_status_counts.done, 1);
  assert.equal(model.waves.waves[0]?.task_status_counts.failed, 1);
  assert.equal(model.waves.waves[0]?.completed_task_count, 1);
  assert.equal(model.waves.waves[0]?.completion_ratio, 0.5);
  assert.deepEqual(model.waves.waves[0]?.skipped_ready_tasks, [{ task_id: "T3", reason: "Skipped for test" }]);
  assert.equal(model.waves.waves[0]?.reason, "Test wave");
  assert.equal(model.failures.failed_tasks[0]?.failure_reason, "Compile error");
  assert.equal(model.failures.blocked_tasks[0]?.blocked_reason, "Blocked by dependency T2.");
  assert.equal(model.failures.failed_tasks.length, 1);
  assert.equal(model.failures.failed_tasks[0]?.retry_count, 0);
  assert.equal(model.failures.failed_tasks[0]?.next_recommendation, null);
  assert.equal(model.failures.failed_tasks[0]?.downstream_impact.length, 1);
  assert.equal(model.failures.failed_tasks[0]?.downstream_impact[0]?.task_id, "T3");
  assert.equal(model.failures.failed_tasks[0]?.downstream_impact[0]?.title, "Blocked grandchild");
  assert.equal(model.failures.failed_tasks[0]?.downstream_impact[0]?.status, "blocked");
  assert.equal(model.failures.failed_tasks[0]?.downstream_impact[0]?.blocked_reason, "Blocked by dependency T2.");
  assert.equal(model.board.agent_load[0]?.active_task_count, 1);
  assert.equal(model.board.agent_load[0]?.capacity_remaining, 1);
  assert.deepEqual(model.board.agent_load[0]?.active_task_ids, ["T2"]);
});

test("failure tracking shows multi-level downstream impact", () => {
  const state = createInitialWorkflowState("wf_downstream_impact", loadPlan({
    plan_id: "plan_downstream_impact",
    plan_type: "dag",
    execution_policy: {},
    tasks: [
      { id: "A", title: "Root" },
      { id: "B", title: "Failed task", depends_on: ["A"] },
      { id: "C", title: "Child of failed", depends_on: ["B"] },
      { id: "D", title: "Grandchild of failed", depends_on: ["C"] },
      { id: "E", title: "Another child of failed", depends_on: ["B"] }
    ]
  }), "2026-04-26T00:00:00.000Z");
  state.tasks.A!.status = "done";
  state.tasks.B!.status = "failed";
  state.tasks.B!.failure_type = "test_failure";
  state.tasks.B!.failure_reason = "Assertion failed";
  state.tasks.B!.retry_count = 2;
  state.tasks.B!.next_recommendation = "Fix assertion and retry";
  state.tasks.C!.status = "blocked";
  state.tasks.C!.blocked_reason = "Blocked by dependency B.";
  state.tasks.D!.status = "blocked";
  state.tasks.D!.blocked_reason = "Blocked by dependency C.";
  state.tasks.E!.status = "blocked";
  state.tasks.E!.blocked_reason = "Blocked by dependency B.";

  const model = createVisualizationModel(state, "2026-04-26T00:10:00.000Z");

  assert.equal(model.failures.failed_tasks.length, 1);
  const failed = model.failures.failed_tasks[0]!;
  assert.equal(failed.task_id, "B");
  assert.equal(failed.failure_type, "test_failure");
  assert.equal(failed.failure_reason, "Assertion failed");
  assert.equal(failed.retry_count, 2);
  assert.equal(failed.next_recommendation, "Fix assertion and retry");

  assert.equal(failed.downstream_impact.length, 3);
  const impactedIds = failed.downstream_impact.map((t) => t.task_id);
  assert.deepEqual(impactedIds, ["C", "D", "E"]);

  const dView = failed.downstream_impact.find((t) => t.task_id === "D");
  assert.equal(dView?.status, "blocked");
  assert.equal(dView?.blocked_reason, "Blocked by dependency C.");
});

test("exportVisualization returns ok result for valid state", () => {
  const state = createInitialWorkflowState("wf_export_ok", loadPlan({
    plan_id: "plan_export_ok",
    plan_type: "dag",
    execution_policy: {},
    tasks: [{ id: "T1", title: "Task one" }]
  }), "2026-04-26T00:00:00.000Z");

  const result = exportVisualization(state);

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.data.workflow.workflow_id, "wf_export_ok");
    assert.equal(result.data.board.totals.total_tasks, 1);
    assert.equal(result.data.dag.nodes.length, 1);
    assert.equal(result.data.waves.total_waves, 0);
    assert.equal(result.data.failures.failed_tasks.length, 0);
    assert.equal(result.data.failures.blocked_tasks.length, 0);
  }
});

test("exportVisualization returns error for null state", () => {
  const result = exportVisualization(null);

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, "VISUALIZATION_STATE_MISSING");
    assert.equal(result.error.message, "Workflow state is required for visualization export.");
  }
});
