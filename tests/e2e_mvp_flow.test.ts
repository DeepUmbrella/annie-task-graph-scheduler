import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assignWorkers } from "../src/execution/worker_pool.js";
import { collectResult } from "../src/execution/result_collector.js";
import { reviewWave } from "../src/execution/review_gate.js";
import { resolveDependencies } from "../src/scheduler/dependency_resolver.js";
import { generateNextWave } from "../src/scheduler/scheduler.js";
import { createStateStore } from "../src/storage/state_store.js";
import { recoverWorkflow } from "../src/storage/recovery_manager.js";
import { createInitialWorkflowState, loadPlan } from "../src/validation/plan_loader.js";

const mvpPlan = {
  plan_id: "plan_mvp_flow",
  plan_type: "dag",
  execution_policy: {
    max_parallel_tasks: 3,
    max_agents: 3
  },
  tasks: [
    { id: "T1", title: "定义协议", can_parallel: false, preferred_agent: "backend-agent" },
    { id: "T2", title: "实现服务端", depends_on: ["T1"], preferred_agent: "backend-agent" },
    { id: "T3", title: "实现客户端", depends_on: ["T1"], preferred_agent: "frontend-agent" },
    { id: "T4", title: "写测试", depends_on: ["T2", "T3"], preferred_agent: "test-agent" },
    { id: "T5", title: "更新文档", depends_on: ["T1"], preferred_agent: "docs-agent" },
    { id: "T6", title: "最终 Review", depends_on: ["T4", "T5"], preferred_agent: "review-agent" }
  ]
} as const;

test("runs the PRD MVP flow as waves T1 -> T2/T3/T5 -> T4 -> T6", () => {
  let state = createInitialWorkflowState("wf_mvp_flow", loadPlan(mvpPlan), "2026-04-26T00:00:00.000Z");
  const waves: string[][] = [];

  state = resolveDependencies(state).state;
  let wave = generateNextWave(state).wave!;
  waves.push(wave.tasks);
  state = assignWorkers(state, wave).state;
  state = collectResult(state, { task_id: "T1", status: "completed", summary: "Protocol done." }).state;
  state = reviewWave(state, wave.id).state;

  state = resolveDependencies(state).state;
  wave = generateNextWave(state).wave!;
  waves.push(wave.tasks);
  state = assignWorkers(state, wave).state;
  for (const taskId of wave.tasks) {
    state = collectResult(state, { task_id: taskId, status: "completed", summary: `${taskId} done.` }).state;
  }
  state = reviewWave(state, wave.id).state;

  state = resolveDependencies(state).state;
  wave = generateNextWave(state).wave!;
  waves.push(wave.tasks);
  state = assignWorkers(state, wave).state;
  state = collectResult(state, { task_id: "T4", status: "completed", summary: "Tests done." }).state;
  state = reviewWave(state, wave.id).state;

  state = resolveDependencies(state).state;
  wave = generateNextWave(state).wave!;
  waves.push(wave.tasks);
  state = assignWorkers(state, wave).state;
  state = collectResult(state, { task_id: "T6", status: "completed", summary: "Review done." }).state;
  state = reviewWave(state, wave.id).state;

  assert.deepEqual(waves, [["T1"], ["T2", "T3", "T5"], ["T4"], ["T6"]]);
  assert.equal(Object.values(state.tasks).every((task) => task.status === "done"), true);
});

test("blocks T4 when T3 fails", () => {
  let state = createInitialWorkflowState("wf_mvp_failure", loadPlan(mvpPlan), "2026-04-26T00:00:00.000Z");

  state = resolveDependencies(state).state;
  const wave1 = generateNextWave(state).wave!;
  state = assignWorkers(state, wave1).state;
  state = collectResult(state, { task_id: "T1", status: "completed", summary: "Protocol done." }).state;
  state = reviewWave(state, wave1.id).state;

  state = resolveDependencies(state).state;
  const wave2 = generateNextWave(state).wave!;
  state = assignWorkers(state, wave2).state;
  state = collectResult(state, { task_id: "T2", status: "completed", summary: "Backend done." }).state;
  state = collectResult(state, { task_id: "T3", status: "failed", summary: "Frontend failed." }).state;
  state = collectResult(state, { task_id: "T5", status: "completed", summary: "Docs done." }).state;
  state = reviewWave(state, wave2.id).state;
  state = resolveDependencies(state).state;

  assert.equal(state.tasks.T4?.status, "blocked");
});

test("recovers lost running sessions and preserves done tasks", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "annie-tgs-recovery-"));
  const store = createStateStore(rootDir);
  let state = createInitialWorkflowState("wf_recovery", loadPlan(mvpPlan), "2026-04-26T00:00:00.000Z");

  state.tasks.T1!.status = "done";
  state.tasks.T2!.status = "running";
  state.tasks.T2!.assigned_to = "backend-agent";
  await store.saveState(state);

  const recovered = await recoverWorkflow(store, "wf_recovery", {
    now: "2026-04-26T00:10:00.000Z"
  });

  assert.equal(recovered.state.tasks.T1?.status, "done");
  assert.equal(recovered.state.tasks.T2?.status, "failed");
  assert.equal(recovered.state.tasks.T4?.status, "blocked");

  const audit = await readFile(store.auditPath("wf_recovery"), "utf8");
  assert.match(audit, /WORKFLOW_RECOVERY/);
});
