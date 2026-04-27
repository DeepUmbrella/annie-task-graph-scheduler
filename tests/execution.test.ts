import test from "node:test";
import assert from "node:assert/strict";
import { assignWorkers } from "../src/execution/worker_pool.js";
import { collectResult, validateWorkerTaskResult } from "../src/execution/result_collector.js";
import { decideRetry } from "../src/execution/retry_policy.js";
import { reviewWave } from "../src/execution/review_gate.js";
import { generateNextWave } from "../src/scheduler/scheduler.js";
import { createInitialWorkflowState, loadPlan } from "../src/validation/plan_loader.js";
import { TaskGraphSchedulerError } from "../src/errors.js";

function createReadyState() {
  const state = createInitialWorkflowState("wf_execution_test", loadPlan({
    plan_id: "plan_execution_test",
    plan_type: "dag",
    execution_policy: {},
    tasks: [
      { id: "T1", title: "Backend", preferred_agent: "backend-agent" },
      { id: "T2", title: "Frontend", preferred_agent: "frontend-agent" }
    ]
  }), "2026-04-26T00:00:00.000Z");

  state.tasks.T1!.status = "ready";
  state.tasks.T2!.status = "ready";

  return state;
}

test("assignWorkers assigns every wave task and moves tasks to running", () => {
  const state = createReadyState();
  const wave = generateNextWave(state).wave!;
  const result = assignWorkers(state, wave, { now: "2026-04-26T00:01:00.000Z" });

  assert.deepEqual(result.assignments, [
    { task_id: "T1", assigned_to: "backend-agent", decision: "preferred_agent_available" },
    { task_id: "T2", assigned_to: "frontend-agent", decision: "preferred_agent_available" }
  ]);
  assert.equal(result.state.tasks.T1?.status, "running");
  assert.equal(result.state.tasks.T2?.status, "running");
  assert.equal(result.state.waves[0]?.status, "running");
  assert.equal(result.audit_events.length, 4);
});

test("assignWorkers uses least-loaded capable agent when preferred agent is unavailable", () => {
  const state = createReadyState();
  state.tasks.T1!.preferred_agent = "offline-backend";
  state.tasks.T1!.required_capabilities = ["backend"];
  state.agents = {
    "offline-backend": {
      agent_id: "offline-backend",
      capabilities: ["backend"],
      active_task_ids: [],
      max_concurrent_tasks: 1,
      session_id: null,
      status: "offline"
    },
    "backend-agent-a": {
      agent_id: "backend-agent-a",
      capabilities: ["backend"],
      active_task_ids: ["existing-task"],
      max_concurrent_tasks: 2,
      session_id: null,
      status: "busy"
    },
    "backend-agent-b": {
      agent_id: "backend-agent-b",
      capabilities: ["backend"],
      active_task_ids: [],
      max_concurrent_tasks: 2,
      session_id: null,
      status: "idle"
    },
    "frontend-agent": {
      agent_id: "frontend-agent",
      capabilities: [],
      active_task_ids: [],
      max_concurrent_tasks: 1,
      session_id: null,
      status: "idle"
    }
  };

  const result = assignWorkers(state, {
    id: "wave_001",
    tasks: ["T1"],
    status: "pending",
    started_at: null,
    completed_at: null,
    review: null,
    reason: "",
    skipped_ready_tasks: []
  });

  assert.deepEqual(result.assignments, [
    { task_id: "T1", assigned_to: "backend-agent-b", decision: "least_loaded_capable_agent" }
  ]);
  assert.deepEqual(result.state.agents["backend-agent-b"]?.active_task_ids, ["T1"]);
});

test("assignWorkers rejects tasks when no capable agent is available", () => {
  const state = createReadyState();
  state.tasks.T1!.required_capabilities = ["backend"];
  state.tasks.T1!.preferred_agent = null;
  state.agents = {
    "docs-agent": {
      agent_id: "docs-agent",
      capabilities: ["docs"],
      active_task_ids: [],
      max_concurrent_tasks: 1,
      session_id: null,
      status: "idle"
    }
  };

  assert.throws(
    () => assignWorkers(state, {
      id: "wave_001",
      tasks: ["T1"],
      status: "pending",
      started_at: null,
      completed_at: null,
      review: null,
      reason: "",
      skipped_ready_tasks: []
    }),
    (error) => error instanceof TaskGraphSchedulerError
      && error.code === "NO_AVAILABLE_AGENT"
  );
});

test("assignWorkers rejects non-ready tasks", () => {
  const state = createReadyState();
  const wave = generateNextWave(state).wave!;
  state.tasks.T1!.status = "pending";

  assert.throws(
    () => assignWorkers(state, wave),
    (error) => error instanceof TaskGraphSchedulerError
      && error.code === "TASK_NOT_READY_FOR_ASSIGNMENT"
  );
});

test("validateWorkerTaskResult requires task_id status and summary", () => {
  assert.throws(
    () => validateWorkerTaskResult({ task_id: "T1", status: "completed" }),
    (error) => error instanceof TaskGraphSchedulerError
      && error.code === "WORKER_RESULT_INVALID"
  );
});

test("collectResult moves completed running task to reviewing", () => {
  const state = createReadyState();
  const assigned = assignWorkers(state, generateNextWave(state).wave!).state;
  const collected = collectResult(assigned, {
    task_id: "T1",
    status: "completed",
    summary: "Implemented backend.",
    changed_files: ["server.ts"],
    tests_run: ["npm test"],
    risks: [],
    next_recommendation: "Review wave."
  }, "2026-04-26T00:02:00.000Z");

  assert.equal(collected.state.tasks.T1?.status, "reviewing");
  assert.deepEqual(collected.state.tasks.T1?.changed_files, ["server.ts"]);
  assert.deepEqual(collected.state.tasks.T1?.tests_run, ["npm test"]);
});

test("collectResult moves failed running task to failed", () => {
  const state = createReadyState();
  const assigned = assignWorkers(state, generateNextWave(state).wave!).state;
  const collected = collectResult(assigned, {
    task_id: "T1",
    status: "failed",
    summary: "Command timed out.",
    failure_type: "implementation",
    failure_reason: "Timeout"
  });

  assert.equal(collected.state.tasks.T1?.status, "failed");
  assert.equal(collected.state.tasks.T1?.failure_type, "implementation");
});

test("decideRetry allows configured transient retries", () => {
  const state = createReadyState();
  const decision = decideRetry(state.tasks.T1!, "transient", state.execution_policy.retry);

  assert.equal(decision.should_retry, true);
  assert.equal(decision.next_retry_count, 1);
});

test("collectResult moves retryable transient failure back to ready", () => {
  const state = createReadyState();
  const assigned = assignWorkers(state, generateNextWave(state).wave!).state;
  const collected = collectResult(assigned, {
    task_id: "T1",
    status: "failed",
    summary: "Command timed out.",
    failure_type: "transient",
    failure_reason: "Timeout"
  });

  assert.equal(collected.state.tasks.T1?.status, "ready");
  assert.equal(collected.state.tasks.T1?.retry_count, 1);
  assert.equal(collected.state.tasks.T1?.assigned_to, null);
  assert.equal(collected.audit_events.some((event) => event.type === "TASK_RETRY_SCHEDULED"), true);
});

test("collectResult does not retry after retry limit is reached", () => {
  const state = createReadyState();
  state.tasks.T1!.retry_count = 1;
  const assigned = assignWorkers(state, generateNextWave(state).wave!).state;
  const collected = collectResult(assigned, {
    task_id: "T1",
    status: "failed",
    summary: "Command timed out again.",
    failure_type: "transient",
    failure_reason: "Timeout"
  });

  assert.equal(collected.state.tasks.T1?.status, "failed");
  assert.equal(collected.state.tasks.T1?.retry_count, 1);
  assert.equal(collected.audit_events.some((event) => event.type === "TASK_RETRY_SKIPPED"), true);
});

test("reviewWave passes when all wave tasks are reviewing", () => {
  const state = createReadyState();
  const assigned = assignWorkers(state, generateNextWave(state).wave!).state;
  const collectedT1 = collectResult(assigned, {
    task_id: "T1",
    status: "completed",
    summary: "Implemented backend.",
    changed_files: ["server.ts"]
  }).state;
  const collectedT2 = collectResult(collectedT1, {
    task_id: "T2",
    status: "completed",
    summary: "Implemented frontend.",
    changed_files: ["ui.ts"]
  }).state;
  const reviewed = reviewWave(collectedT2, "wave_001", "2026-04-26T00:03:00.000Z");

  assert.equal(reviewed.review.status, "passed");
  assert.equal(reviewed.review.allow_next_wave, true);
  assert.equal(reviewed.state.tasks.T1?.status, "done");
  assert.equal(reviewed.state.tasks.T2?.status, "done");
});

test("reviewWave fails on changed file conflicts", () => {
  const state = createReadyState();
  const assigned = assignWorkers(state, generateNextWave(state).wave!).state;
  const collectedT1 = collectResult(assigned, {
    task_id: "T1",
    status: "completed",
    summary: "Changed shared file.",
    changed_files: ["shared.ts"]
  }).state;
  const collectedT2 = collectResult(collectedT1, {
    task_id: "T2",
    status: "completed",
    summary: "Also changed shared file.",
    changed_files: ["shared.ts"]
  }).state;
  const reviewed = reviewWave(collectedT2, "wave_001");

  assert.equal(reviewed.review.status, "failed");
  assert.equal(reviewed.review.allow_next_wave, false);
  assert.match(reviewed.review.conflicts[0] ?? "", /shared.ts/);
});

test("reviewWave fails when a task failed", () => {
  const state = createReadyState();
  const assigned = assignWorkers(state, generateNextWave(state).wave!).state;
  const collectedT1 = collectResult(assigned, {
    task_id: "T1",
    status: "failed",
    summary: "Implementation failed."
  }).state;
  const collectedT2 = collectResult(collectedT1, {
    task_id: "T2",
    status: "completed",
    summary: "Implemented frontend."
  }).state;
  const reviewed = reviewWave(collectedT2, "wave_001");

  assert.equal(reviewed.review.status, "failed");
  assert.deepEqual(reviewed.review.failed_tasks, ["T1"]);
  assert.equal(reviewed.state.status, "blocked");
});
