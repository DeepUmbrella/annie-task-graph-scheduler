import test from "node:test";
import assert from "node:assert/strict";
import { createWorkflowExecutionReport } from "../src/reporting/index.js";
import { createInitialWorkflowState, loadPlan } from "../src/validation/plan_loader.js";

test("createWorkflowExecutionReport summarizes workflow execution state", () => {
  const state = createInitialWorkflowState("wf_report", loadPlan({
    plan_id: "plan_report",
    plan_type: "dag",
    execution_policy: {},
    tasks: [
      {
        id: "T1",
        title: "Done task"
      },
      {
        id: "T2",
        title: "Failed task",
        depends_on: ["T1"]
      },
      {
        id: "T3",
        title: "Blocked task",
        depends_on: ["T2"]
      }
    ]
  }), "2026-04-28T00:00:00.000Z");
  state.status = "blocked";
  state.current_wave = "wave_002";
  state.updated_at = "2026-04-28T00:30:00.000Z";
  state.tasks.T1!.status = "done";
  state.tasks.T1!.result_summary = "Completed setup.";
  state.tasks.T1!.changed_files = ["src/setup.ts"];
  state.tasks.T1!.tests_run = ["npm test"];
  state.tasks.T2!.status = "failed";
  state.tasks.T2!.failure_type = "implementation";
  state.tasks.T2!.failure_reason = "Compile error";
  state.tasks.T3!.status = "blocked";
  state.tasks.T3!.blocked_reason = "Blocked by dependency T2.";
  state.waves.push({
    id: "wave_001",
    tasks: ["T1"],
    status: "done",
    started_at: "2026-04-28T00:01:00.000Z",
    completed_at: "2026-04-28T00:02:00.000Z",
    review: {
      status: "passed",
      completed_tasks: ["T1"],
      failed_tasks: [],
      conflicts: [],
      allow_next_wave: true
    },
    reason: "First wave",
    skipped_ready_tasks: []
  });
  state.waves.push({
    id: "wave_002",
    tasks: ["T2"],
    status: "failed",
    started_at: "2026-04-28T00:03:00.000Z",
    completed_at: "2026-04-28T00:04:00.000Z",
    review: {
      status: "failed",
      completed_tasks: [],
      failed_tasks: ["T2"],
      conflicts: [],
      allow_next_wave: false
    },
    reason: "Second wave",
    skipped_ready_tasks: []
  });

  const report = createWorkflowExecutionReport(state, {
    generated_at: "2026-04-28T00:40:00.000Z"
  });

  assert.equal(report.workflow_id, "wf_report");
  assert.equal(report.plan_id, "plan_report");
  assert.equal(report.status, "blocked");
  assert.equal(report.generated_at, "2026-04-28T00:40:00.000Z");
  assert.equal(report.task_summary.total, 3);
  assert.equal(report.task_summary.completed, 1);
  assert.equal(report.task_summary.failed, 1);
  assert.equal(report.task_summary.blocked, 1);
  assert.equal(report.tasks[0]?.changed_files_count, 1);
  assert.equal(report.tasks[0]?.tests_run_count, 1);
  assert.deepEqual(report.wave_summary.reviews.map((review) => `${review.wave_id}:${review.status}:${review.allow_next_wave}`), [
    "wave_001:passed:true",
    "wave_002:failed:false"
  ]);
  assert.deepEqual(report.failures.map((failure) => `${failure.task_id}:${failure.status}`), [
    "T2:failed",
    "T3:blocked"
  ]);
  assert.equal(report.handoff.source, "TaskGraphScheduler");
  assert.equal(report.handoff.target, "ExecutionWorkflow");
  assert.equal(report.handoff.audit_required, true);
  assert.equal(report.handoff.state_updated_at, "2026-04-28T00:30:00.000Z");
});
