import test from "node:test";
import assert from "node:assert/strict";
import { detectFileConflicts } from "../src/scheduler/conflict_detector.js";
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
      task_ids: ["T1", "T2"]
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
  assert.match(result.skipped_ready_tasks[0]?.reason ?? "", /expected_files conflicts/);
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
  assert.match(result.skipped_ready_tasks[0]?.reason ?? "", /high-risk/);
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
});

test("returns null wave when no tasks are ready", () => {
  const state = createState([
    { id: "T1", title: "One" }
  ]);
  state.tasks.T1!.status = "pending";

  const result = generateNextWave(state);

  assert.equal(result.wave, null);
});
