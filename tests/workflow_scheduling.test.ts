import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createStateStore } from "../src/storage/state_store.js";
import { scheduleNextWorkflowWave } from "../src/workflow_scheduling/index.js";
import { createInitialWorkflowState, loadPlan } from "../src/validation/plan_loader.js";
import type { WorkflowState } from "../src/models/workflow.js";

function workflowState(workflowId: string, tasks: unknown[], now = "2026-05-02T00:00:00.000Z"): WorkflowState {
  return createInitialWorkflowState(workflowId, loadPlan({
    plan_id: `plan_${workflowId}`,
    plan_type: "dag",
    execution_policy: {},
    tasks
  }), now);
}

async function saveWorkflow(rootDir: string, state: WorkflowState): Promise<void> {
  await createStateStore(rootDir).saveState(state);
}

test("scheduleNextWorkflowWave creates the first wave without dispatching tasks", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "annie-workflow-scheduling-"));
  await saveWorkflow(rootDir, workflowState("wf_schedule", [
    {
      id: "T1",
      title: "Root"
    },
    {
      id: "T2",
      title: "Downstream",
      depends_on: ["T1"]
    }
  ]));

  const result = await scheduleNextWorkflowWave({
    workflow_id: "wf_schedule"
  }, {
    rootDir,
    now: "2026-05-02T01:00:00.000Z"
  });

  assert.equal(result.decision.status, "scheduled");
  assert.equal(result.decision.wave_id, "wave_001");
  assert.equal(result.next_wave?.wave?.id, "wave_001");
  assert.deepEqual(result.next_wave?.wave?.tasks, ["T1"]);
  assert.equal(result.state.current_wave, "wave_001");
  assert.equal(result.state.waves[0]?.status, "pending");
  assert.equal(result.state.tasks.T1?.status, "ready");
  assert.equal(result.state.tasks.T1?.assigned_to, null);
  assert.equal(result.state.tasks.T1?.started_at, null);

  const audit = await readFile(result.audit_path, "utf8");
  assert.match(audit, /WORKFLOW_WAVE_SCHEDULED/);
  assert.match(audit, /TASK_STATUS_CHANGED/);
});

test("scheduleNextWorkflowWave is idempotent when an active wave exists", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "annie-workflow-scheduling-active-"));
  await saveWorkflow(rootDir, workflowState("wf_active", [
    {
      id: "T1",
      title: "Root"
    }
  ]));

  const first = await scheduleNextWorkflowWave({
    workflow_id: "wf_active"
  }, {
    rootDir,
    now: "2026-05-02T01:00:00.000Z"
  });
  const second = await scheduleNextWorkflowWave({
    workflow_id: "wf_active"
  }, {
    rootDir,
    now: "2026-05-02T01:01:00.000Z"
  });

  assert.equal(first.decision.status, "scheduled");
  assert.equal(second.decision.status, "active_wave");
  assert.equal(second.decision.wave_id, "wave_001");
  assert.equal(second.state.waves.length, 1);
});

test("scheduleNextWorkflowWave reports no ready tasks without creating a wave", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "annie-workflow-scheduling-no-ready-"));
  const state = workflowState("wf_no_ready", [
    {
      id: "T1",
      title: "Running root"
    },
    {
      id: "T2",
      title: "Waiting",
      depends_on: ["T1"]
    }
  ]);
  await saveWorkflow(rootDir, {
    ...state,
    tasks: {
      ...state.tasks,
      T1: {
        ...state.tasks.T1!,
        status: "running"
      }
    }
  });

  const result = await scheduleNextWorkflowWave({
    workflow_id: "wf_no_ready"
  }, {
    rootDir,
    now: "2026-05-02T01:00:00.000Z"
  });

  assert.equal(result.decision.status, "no_ready_tasks");
  assert.equal(result.next_wave?.wave, null);
  assert.equal(result.state.waves.length, 0);
});

test("scheduleNextWorkflowWave reports completed workflows", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "annie-workflow-scheduling-completed-"));
  const state = workflowState("wf_done", [
    {
      id: "T1",
      title: "Root"
    }
  ]);
  await saveWorkflow(rootDir, {
    ...state,
    tasks: {
      ...state.tasks,
      T1: {
        ...state.tasks.T1!,
        status: "done"
      }
    }
  });

  const result = await scheduleNextWorkflowWave({
    workflow_id: "wf_done"
  }, {
    rootDir,
    now: "2026-05-02T01:00:00.000Z"
  });

  assert.equal(result.decision.status, "completed");
  assert.equal(result.state.status, "done");
  assert.equal(result.next_wave, null);
});
