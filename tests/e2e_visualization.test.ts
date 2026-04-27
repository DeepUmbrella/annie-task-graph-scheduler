import test from "node:test";
import assert from "node:assert/strict";
import { assignWorkers } from "../src/execution/worker_pool.js";
import { collectResult } from "../src/execution/result_collector.js";
import { reviewWave } from "../src/execution/review_gate.js";
import { resolveDependencies } from "../src/scheduler/dependency_resolver.js";
import { generateNextWave } from "../src/scheduler/scheduler.js";
import { createInitialWorkflowState, loadPlan } from "../src/validation/plan_loader.js";
import { exportVisualization } from "../src/visualization/projection.js";

const phase03Plan = {
  plan_id: "plan_phase_03_flow",
  plan_type: "dag",
  execution_policy: {
    max_parallel_tasks: 5,
    max_agents: 5,
    scheduling: { selection_order: "risk_aware", prefer_low_risk_first: true, explain_skipped_tasks: true },
    conflicts: { mode: "exact", unknown_files_policy: "allow" },
    retry: { max_retries: 1, retry_on: ["transient"], manual_review_on_second_failure: true, backoff: "none" }
  },
  tasks: [
    { id: "A", title: "Design API", risk: "low", preferred_agent: "backend-agent", required_capabilities: ["backend"] },
    { id: "B", title: "Implement server", depends_on: ["A"], risk: "medium", expected_files: ["src/server.ts"], preferred_agent: "backend-agent", required_capabilities: ["backend"] },
    { id: "C", title: "Implement client", depends_on: ["A"], risk: "medium", expected_files: ["src/client.ts"], preferred_agent: "frontend-agent", required_capabilities: ["frontend"] },
    { id: "D", title: "Integration test", depends_on: ["B", "C"], risk: "high", preferred_agent: "test-agent", required_capabilities: ["testing"] },
    { id: "E", title: "Write docs", depends_on: ["A"], risk: "low", preferred_agent: "docs-agent", required_capabilities: ["docs"] },
    { id: "F", title: "Final review", depends_on: ["D", "E"], risk: "critical", preferred_agent: "review-agent", required_capabilities: ["review"] }
  ]
} as const;

test("Phase 03 visualization: full successful workflow produces complete view model", () => {
  let state = createInitialWorkflowState("wf_phase_03_ok", loadPlan(phase03Plan), "2026-04-27T00:00:00.000Z");
  state.agents = {
    "backend-agent": { agent_id: "backend-agent", capabilities: ["backend"], active_task_ids: [], max_concurrent_tasks: 2, session_id: "s_b", status: "idle" },
    "frontend-agent": { agent_id: "frontend-agent", capabilities: ["frontend"], active_task_ids: [], max_concurrent_tasks: 2, session_id: "s_f", status: "idle" },
    "test-agent": { agent_id: "test-agent", capabilities: ["testing"], active_task_ids: [], max_concurrent_tasks: 1, session_id: "s_t", status: "idle" },
    "docs-agent": { agent_id: "docs-agent", capabilities: ["docs"], active_task_ids: [], max_concurrent_tasks: 1, session_id: "s_d", status: "idle" },
    "review-agent": { agent_id: "review-agent", capabilities: ["review"], active_task_ids: [], max_concurrent_tasks: 1, session_id: "s_r", status: "idle" }
  };

  state = resolveDependencies(state).state;
  let wave = generateNextWave(state).wave!;
  state = assignWorkers(state, wave).state;
  state = collectResult(state, { task_id: "A", status: "completed", summary: "API designed." }).state;
  state = reviewWave(state, wave.id).state;

  state = resolveDependencies(state).state;
  wave = generateNextWave(state).wave!;
  state = assignWorkers(state, wave).state;
  for (const tid of wave.tasks) {
    state = collectResult(state, { task_id: tid, status: "completed", summary: `${tid} done.` }).state;
  }
  state = reviewWave(state, wave.id).state;

  state = resolveDependencies(state).state;
  wave = generateNextWave(state).wave!;
  state = assignWorkers(state, wave).state;
  state = collectResult(state, { task_id: "D", status: "completed", summary: "Tests pass." }).state;
  state = reviewWave(state, wave.id).state;

  state = resolveDependencies(state).state;
  wave = generateNextWave(state).wave!;
  state = assignWorkers(state, wave).state;
  state = collectResult(state, { task_id: "F", status: "completed", summary: "Review done." }).state;
  state = reviewWave(state, wave.id).state;

  const result = exportVisualization(state, "2026-04-27T01:00:00.000Z");
  assert.equal(result.ok, true);
  const model = result.data;

  assert.equal(model.workflow.workflow_id, "wf_phase_03_ok");
  assert.equal(model.workflow.status, "running");
  assert.equal(model.board.totals.total_tasks, 6);
  assert.equal(model.board.totals.completed_tasks, 6);
  assert.equal(model.board.totals.completion_ratio, 1);
  assert.equal(model.board.totals.failed_tasks, 0);
  assert.equal(model.board.totals.blocked_tasks, 0);

  assert.equal(model.dag.nodes.length, 6);
  assert.equal(model.dag.edges.length, 7);
  const aNode = model.dag.nodes.find((n) => n.id === "A");
  assert.equal(aNode?.downstream_count, 3);

  assert.equal(model.waves.total_waves, 4);
  assert.equal(model.waves.completed_waves, 4);
  assert.equal(model.waves.completion_ratio, 1);

  assert.equal(model.failures.failed_tasks.length, 0);
  assert.equal(model.failures.blocked_tasks.length, 0);
  assert.equal(model.generated_at, "2026-04-27T01:00:00.000Z");
});

test("Phase 03 visualization: workflow with failures shows downstream impact and blocked tasks", () => {
  let state = createInitialWorkflowState("wf_phase_03_fail", loadPlan(phase03Plan), "2026-04-27T00:00:00.000Z");
  state.agents = {
    "backend-agent": { agent_id: "backend-agent", capabilities: ["backend"], active_task_ids: [], max_concurrent_tasks: 2, session_id: "s_b", status: "idle" },
    "frontend-agent": { agent_id: "frontend-agent", capabilities: ["frontend"], active_task_ids: [], max_concurrent_tasks: 2, session_id: "s_f", status: "idle" },
    "test-agent": { agent_id: "test-agent", capabilities: ["testing"], active_task_ids: [], max_concurrent_tasks: 1, session_id: "s_t", status: "idle" },
    "docs-agent": { agent_id: "docs-agent", capabilities: ["docs"], active_task_ids: [], max_concurrent_tasks: 1, session_id: "s_d", status: "idle" },
    "review-agent": { agent_id: "review-agent", capabilities: ["review"], active_task_ids: [], max_concurrent_tasks: 1, session_id: "s_r", status: "idle" }
  };

  state = resolveDependencies(state).state;
  let wave = generateNextWave(state).wave!;
  state = assignWorkers(state, wave).state;
  state = collectResult(state, { task_id: "A", status: "completed", summary: "API designed." }).state;
  state = reviewWave(state, wave.id).state;

  state = resolveDependencies(state).state;
  wave = generateNextWave(state).wave!;
  state = assignWorkers(state, wave).state;
  state = collectResult(state, { task_id: "B", status: "failed", summary: "Server crashed.", failure_type: "implementation" }).state;
  state = collectResult(state, { task_id: "C", status: "completed", summary: "Client done." }).state;
  state = collectResult(state, { task_id: "E", status: "completed", summary: "Docs done." }).state;
  state = reviewWave(state, wave.id).state;
  state = resolveDependencies(state).state;

  const result = exportVisualization(state, "2026-04-27T00:30:00.000Z");
  assert.equal(result.ok, true);
  const model = result.data;

  assert.equal(model.board.totals.failed_tasks, 1);
  assert.equal(model.board.totals.blocked_tasks, 2);

  assert.equal(model.failures.failed_tasks.length, 1);
  const failedB = model.failures.failed_tasks[0]!;
  assert.equal(failedB.task_id, "B");
  assert.equal(failedB.failure_type, "implementation");
  assert.equal(failedB.downstream_impact.length, 2);
  const impactedIds = failedB.downstream_impact.map((t) => t.task_id).sort();
  assert.deepEqual(impactedIds, ["D", "F"]);

  assert.equal(model.failures.blocked_tasks.length, 2);
  const blockedD = model.failures.blocked_tasks.find((t) => t.task_id === "D");
  assert.equal(blockedD?.blocked_reason != null, true);

  const blockedEdge = model.dag.edges.find((e) => e.source === "B" && e.target === "D");
  assert.equal(blockedEdge?.status, "blocked");
});

test("Phase 03 visualization: exportVisualization returns error for missing state", () => {
  const result = exportVisualization(null);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, "VISUALIZATION_STATE_MISSING");
  }
});
