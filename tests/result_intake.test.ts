import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { TaskGraphSchedulerError } from "../src/errors.js";
import { createNodeRegistry } from "../src/node_registry/index.js";
import { createStateStore } from "../src/storage/state_store.js";
import { scheduleNextWorkflowWave } from "../src/workflow_scheduling/index.js";
import { dispatchWorkflowWave } from "../src/workflow_dispatch/index.js";
import { intakeAgentResult } from "../src/result_intake/index.js";
import { createInitialWorkflowState, loadPlan } from "../src/validation/plan_loader.js";

async function seedAssignedWorkflow(rootDir: string, options: { retry?: boolean } = {}): Promise<void> {
  const state = createInitialWorkflowState("wf_result", loadPlan({
    plan_id: "plan_result",
    plan_type: "dag",
    execution_policy: options.retry ? {
      retry: {
        max_retries: 1,
        retry_on: ["transient"]
      }
    } : {},
    tasks: [
      {
        id: "T1",
        title: "Build frontend",
        required_capabilities: ["frontend"],
        preferred_agent: "frontend-agent"
      }
    ]
  }), "2026-05-02T00:00:00.000Z");
  await createStateStore(rootDir).saveState(state);
  await createNodeRegistry(rootDir).registerProposal({
    schema_version: "node-registration.v1",
    nodes: [
      {
        node_id: "frontend-agent",
        node_type: "individual",
        declared_capabilities: ["frontend"],
        requested_actions: ["send_message"]
      }
    ]
  });
  await scheduleNextWorkflowWave({ workflow_id: "wf_result" }, { rootDir });
  await dispatchWorkflowWave({ workflow_id: "wf_result" }, { rootDir });
}

test("intakeAgentResult accepts assigned task completion and moves it to reviewing", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "annie-result-intake-"));
  await seedAssignedWorkflow(rootDir);

  const result = await intakeAgentResult({
    workflow_id: "wf_result",
    from: "frontend-agent",
    result: {
      task_id: "T1",
      status: "completed",
      summary: "Implemented frontend.",
      changed_files: ["src/App.tsx"],
      tests_run: ["npm test"]
    }
  }, {
    rootDir,
    now: "2026-05-02T03:00:00.000Z"
  });

  assert.equal(result.decision.status, "accepted");
  assert.equal(result.decision.next_task_status, "reviewing");
  assert.equal(result.state.tasks.T1?.status, "reviewing");
  assert.equal(result.state.tasks.T1?.assigned_to, "frontend-agent");
  assert.equal(result.state.current_wave, "wave_001");
  assert.equal(result.state.waves[0]?.status, "pending");
});

test("intakeAgentResult follows retry policy for failed results", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "annie-result-intake-retry-"));
  await seedAssignedWorkflow(rootDir, { retry: true });

  const result = await intakeAgentResult({
    workflow_id: "wf_result",
    from: "frontend-agent",
    result: {
      task_id: "T1",
      status: "failed",
      summary: "Temporary network failure.",
      failure_type: "transient"
    }
  }, {
    rootDir,
    now: "2026-05-02T03:00:00.000Z"
  });

  assert.equal(result.state.tasks.T1?.status, "ready");
  assert.equal(result.state.tasks.T1?.retry_count, 1);
  assert.equal(result.state.tasks.T1?.assigned_to, null);
});

test("intakeAgentResult rejects unassigned senders", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "annie-result-intake-reject-"));
  await seedAssignedWorkflow(rootDir);

  await assert.rejects(
    () => intakeAgentResult({
      workflow_id: "wf_result",
      from: "backend-agent",
      result: {
        task_id: "T1",
        status: "completed",
        summary: "Wrong sender."
      }
    }, { rootDir }),
    (error) => error instanceof TaskGraphSchedulerError
      && error.code === "RESULT_SENDER_NOT_ASSIGNED"
  );
});
