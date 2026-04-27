import test from "node:test";
import assert from "node:assert/strict";
import { detectFileConflicts } from "../src/scheduler/conflict_detector.js";
import { scoreTaskRisk } from "../src/scheduler/risk_scorer.js";
import { generateNextWave } from "../src/scheduler/scheduler.js";
import { createInitialWorkflowState, loadPlan } from "../src/validation/plan_loader.js";

function createState(tasks: Array<Record<string, unknown>>, policy: Record<string, unknown> = {}) {
  const loaded = loadPlan({
    plan_id: "plan_scheduler_test",
    plan_type: "dag",
    execution_policy: policy,
    tasks
  });
  const state = createInitialWorkflowState("wf_scheduler_test", loaded, "2026-04-26T00:00:00.000Z");

  for (const task of Object.values(state.tasks)) {
    task.status = "ready";
  }

  return state;
}

test("detects file conflicts by exact expected file", () => {
  const state = createState([
    { id: "T1", title: "One", expected_files: ["same.ts"] },
    { id: "T2", title: "Two", expected_files: ["same.ts"] },
    { id: "T3", title: "Three", expected_files: ["other.ts"] }
  ]);

  const conflicts = detectFileConflicts(Object.values(state.tasks));

  assert.deepEqual(conflicts, [
    {
      file: "same.ts",
      task_ids: ["T1", "T2"],
      type: "exact"
    }
  ]);
});

test("puts independent ready tasks into the same wave", () => {
  const state = createState([
    { id: "T1", title: "One" },
    { id: "T2", title: "Two" }
  ]);

  const result = generateNextWave(state);

  assert.deepEqual(result.wave?.tasks, ["T1", "T2"]);
  assert.equal(result.wave?.id, "wave_001");
  assert.deepEqual(result.skipped_ready_tasks, []);
  assert.deepEqual(result.decision.selected_tasks, ["T1", "T2"]);
});

test("does not schedule non-ready tasks", () => {
  const state = createState([
    { id: "T1", title: "One" },
    { id: "T2", title: "Two" }
  ]);
  state.tasks.T2!.status = "pending";

  const result = generateNextWave(state);

  assert.deepEqual(result.wave?.tasks, ["T1"]);
});

test("respects max_parallel_tasks", () => {
  const state = createState([
    { id: "T1", title: "One" },
    { id: "T2", title: "Two" },
    { id: "T3", title: "Three" }
  ], { max_parallel_tasks: 2 });

  const result = generateNextWave(state);

  assert.deepEqual(result.wave?.tasks, ["T1", "T2"]);
  assert.deepEqual(result.skipped_ready_tasks, [
    {
      task_id: "T3",
      reason: "Skipped because max_parallel_tasks=2 has been reached."
    }
  ]);
});

test("serializes file-conflicting ready tasks", () => {
  const state = createState([
    { id: "T1", title: "One", expected_files: ["same.ts"] },
    { id: "T2", title: "Two", expected_files: ["same.ts"] },
    { id: "T3", title: "Three", expected_files: ["other.ts"] }
  ]);

  const result = generateNextWave(state);

  assert.deepEqual(result.wave?.tasks, ["T1", "T3"]);
  assert.equal(result.skipped_ready_tasks[0]?.task_id, "T2");
  assert.match(result.skipped_ready_tasks[0]?.reason ?? "", /exact file conflict/);
});

test("serializes high-risk tasks", () => {
  const state = createState([
    { id: "T1", title: "One", risk: "high" },
    { id: "T2", title: "Two", risk: "critical" },
    { id: "T3", title: "Three", risk: "medium" }
  ]);

  const result = generateNextWave(state);

  assert.deepEqual(result.wave?.tasks, ["T1", "T3"]);
  assert.equal(result.skipped_ready_tasks[0]?.task_id, "T2");
  assert.match(result.skipped_ready_tasks[0]?.reason ?? "", /risk score/);
});

test("respects max_agents using preferred agent hints", () => {
  const state = createState([
    { id: "T1", title: "One", preferred_agent: "backend-agent" },
    { id: "T2", title: "Two", preferred_agent: "frontend-agent" },
    { id: "T3", title: "Three", preferred_agent: "docs-agent" }
  ], { max_agents: 2 });

  const result = generateNextWave(state);

  assert.deepEqual(result.wave?.tasks, ["T1", "T2"]);
  assert.equal(result.skipped_ready_tasks[0]?.task_id, "T3");
  assert.match(result.skipped_ready_tasks[0]?.reason ?? "", /max_agents=2/);
  assert.equal(result.decision.skipped_tasks[0]?.category, "agent_limit");
});

test("returns null wave when no tasks are ready", () => {
  const state = createState([
    { id: "T1", title: "One" }
  ]);
  state.tasks.T1!.status = "pending";

  const result = generateNextWave(state);

  assert.equal(result.wave, null);
});

test("scores task risk with explainable reasons", () => {
  const state = createState([
    {
      id: "T1",
      title: "Risky task",
      risk: "high",
      expected_files: ["a.ts", "b.ts"]
    }
  ]);
  state.tasks.T1!.retry_count = 1;
  state.tasks.T1!.preferred_agent = null;

  const score = scoreTaskRisk(state.tasks.T1!, state.execution_policy.risk);

  assert.equal(score.task_id, "T1");
  assert.equal(score.level, "high");
  assert.equal(score.score > 0, true);
  assert.match(score.reasons.join("\n"), /retry/);
  assert.match(score.reasons.join("\n"), /preferred_agent/);
});

test("orders ready tasks by low risk first when risk-aware policy is enabled", () => {
  const state = createState([
    { id: "T1", title: "High", risk: "high" },
    { id: "T2", title: "Low", risk: "low", expected_files: ["low.ts"], preferred_agent: "docs-agent" },
    { id: "T3", title: "Medium", risk: "medium" }
  ], {
    scheduling: {
      selection_order: "risk_aware",
      prefer_low_risk_first: true,
      explain_skipped_tasks: true
    }
  });

  const result = generateNextWave(state);

  assert.deepEqual(result.wave?.tasks, ["T2", "T3", "T1"]);
  assert.equal(result.risk_scores.T1?.level, "high");
});

test("allows more high-risk tasks when policy limit is increased", () => {
  const state = createState([
    { id: "T1", title: "One", risk: "high" },
    { id: "T2", title: "Two", risk: "critical" }
  ], {
    risk: {
      high_risk_parallel_limit: 2
    }
  });

  const result = generateNextWave(state);

  assert.deepEqual(result.wave?.tasks, ["T1", "T2"]);
});

test("detects directory conflicts when directory mode is enabled", () => {
  const state = createState([
    { id: "T1", title: "One", expected_files: ["src/a.ts"] },
    { id: "T2", title: "Two", expected_files: ["src/b.ts"] }
  ], {
    conflicts: {
      mode: "directory",
      directory_conflict_depth: 1
    }
  });

  const result = generateNextWave(state);

  assert.deepEqual(result.wave?.tasks, ["T1"]);
  assert.equal(result.skipped_ready_tasks[0]?.task_id, "T2");
  assert.match(result.skipped_ready_tasks[0]?.reason ?? "", /directory file conflict/);
  assert.equal(result.decision.conflict_summary[0]?.task_id, "T2");
});

test("detects glob conflicts when glob mode is enabled", () => {
  const state = createState([
    { id: "T1", title: "One", expected_files: ["src/**/*.ts"] },
    { id: "T2", title: "Two", expected_files: ["src/features/a.ts"] }
  ], {
    conflicts: {
      mode: "glob"
    }
  });

  const result = generateNextWave(state);

  assert.deepEqual(result.wave?.tasks, ["T1"]);
  assert.equal(result.skipped_ready_tasks[0]?.task_id, "T2");
  assert.match(result.skipped_ready_tasks[0]?.reason ?? "", /glob file conflict/);
});

test("serializes unknown expected files when policy requires it", () => {
  const state = createState([
    { id: "T1", title: "One" },
    { id: "T2", title: "Two" }
  ], {
    conflicts: {
      unknown_files_policy: "serialize"
    }
  });

  const result = generateNextWave(state);

  assert.deepEqual(result.wave?.tasks, ["T1"]);
  assert.equal(result.skipped_ready_tasks[0]?.task_id, "T2");
  assert.match(result.skipped_ready_tasks[0]?.reason ?? "", /unknown_files/);
});

test("returns structured wave decision for policy observability", () => {
  const state = createState([
    { id: "T1", title: "One", risk: "high" },
    { id: "T2", title: "Two", risk: "critical" }
  ]);
  state.agents = {
    "backend-agent": {
      agent_id: "backend-agent",
      capabilities: ["backend"],
      active_task_ids: ["existing-task"],
      max_concurrent_tasks: 2,
      session_id: "session_backend",
      status: "busy"
    }
  };

  const result = generateNextWave(state);

  assert.equal(result.decision.policy_applied.high_risk_parallel_limit, 1);
  assert.deepEqual(result.decision.selected_tasks, ["T1"]);
  assert.equal(result.decision.skipped_tasks[0]?.category, "risk_limit");
  assert.equal(result.decision.risk_summary[0]?.task_id, "T1");
  assert.equal(result.decision.agent_load_summary[0]?.agent_id, "backend-agent");
});
