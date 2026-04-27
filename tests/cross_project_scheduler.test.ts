import test from "node:test";
import assert from "node:assert/strict";
import { TaskGraphSchedulerError, buildGlobalTaskQueue } from "../src/index.js";
import type { ProjectRef, ProjectWorkflowRef, WorkflowState } from "../src/index.js";
import { createInitialWorkflowState, loadPlan } from "../src/validation/plan_loader.js";

function createProject(projectId: string, name: string, priority: ProjectRef["priority"] = "normal"): ProjectRef {
  return {
    project_id: projectId,
    name,
    root_path: `/workspace/${projectId}`,
    priority,
    tags: [],
    created_at: "2026-04-27T00:00:00.000Z",
    updated_at: "2026-04-27T00:00:00.000Z"
  };
}

function createWorkflow(projectId: string, workflowId: string, planId: string, priority: ProjectWorkflowRef["priority"] = "normal"): ProjectWorkflowRef {
  return {
    project_id: projectId,
    workflow_id: workflowId,
    plan_id: planId,
    state_path: `.annie/workflows/${workflowId}/state.json`,
    status: "running",
    priority,
    registered_at: "2026-04-27T00:00:00.000Z",
    updated_at: "2026-04-27T00:00:00.000Z"
  };
}

function createState(workflowId: string, planId: string): WorkflowState {
  return createInitialWorkflowState(workflowId, loadPlan({
    plan_id: planId,
    plan_type: "dag",
    execution_policy: {},
    tasks: [
      {
        id: "T_ready",
        title: "Ready task",
        risk: "medium",
        expected_files: ["src/ready.ts"],
        required_capabilities: ["backend"],
        preferred_agent: "backend-agent"
      },
      {
        id: "T_pending",
        title: "Pending task"
      },
      {
        id: "T_running",
        title: "Running task"
      },
      {
        id: "T_reviewing",
        title: "Reviewing task"
      },
      {
        id: "T_done",
        title: "Done task"
      },
      {
        id: "T_failed",
        title: "Failed task"
      },
      {
        id: "T_blocked",
        title: "Blocked task"
      }
    ]
  }), "2026-04-27T00:00:00.000Z");
}

test("buildGlobalTaskQueue includes only ready tasks with cross-project metadata", () => {
  const project = createProject("project_api", "API", "high");
  const workflow = createWorkflow(project.project_id, "wf_api", "plan_api", "focus");
  const state = createState(workflow.workflow_id, workflow.plan_id);

  state.tasks.T_ready!.status = "ready";
  state.tasks.T_pending!.status = "pending";
  state.tasks.T_running!.status = "running";
  state.tasks.T_reviewing!.status = "reviewing";
  state.tasks.T_done!.status = "done";
  state.tasks.T_failed!.status = "failed";
  state.tasks.T_blocked!.status = "blocked";

  const result = buildGlobalTaskQueue([{ project, workflow, state }]);

  assert.deepEqual(result.items.map((item) => item.id), ["project_api:wf_api:T_ready"]);
  assert.equal(result.items[0]?.project_id, "project_api");
  assert.equal(result.items[0]?.project_name, "API");
  assert.equal(result.items[0]?.workflow_id, "wf_api");
  assert.equal(result.items[0]?.plan_id, "plan_api");
  assert.equal(result.items[0]?.task_id, "T_ready");
  assert.equal(result.items[0]?.project_priority, "high");
  assert.equal(result.items[0]?.user_priority, "focus");
  assert.equal(result.items[0]?.risk, "medium");
  assert.equal((result.items[0]?.risk_score ?? 0) > 0, true);
  assert.deepEqual(result.items[0]?.required_capabilities, ["backend"]);
  assert.equal(result.items[0]?.preferred_agent, "backend-agent");
  assert.deepEqual(result.skipped.map((item) => item.task_id), [
    "T_blocked",
    "T_done",
    "T_failed",
    "T_pending",
    "T_reviewing",
    "T_running"
  ]);
});

test("buildGlobalTaskQueue produces stable ordering across projects workflows and tasks", () => {
  const projectB = createProject("project_b", "B");
  const workflowB = createWorkflow(projectB.project_id, "wf_b", "plan_b");
  const stateB = createState(workflowB.workflow_id, workflowB.plan_id);
  stateB.tasks.T_ready!.status = "ready";

  const projectA = createProject("project_a", "A");
  const workflowA = createWorkflow(projectA.project_id, "wf_a", "plan_a");
  const stateA = createState(workflowA.workflow_id, workflowA.plan_id);
  stateA.tasks.T_ready!.status = "ready";

  const result = buildGlobalTaskQueue([
    { project: projectB, workflow: workflowB, state: stateB },
    { project: projectA, workflow: workflowA, state: stateA }
  ]);

  assert.deepEqual(result.items.map((item) => item.id), [
    "project_a:wf_a:T_ready",
    "project_b:wf_b:T_ready"
  ]);
});

test("buildGlobalTaskQueue rejects mismatched workflow references", () => {
  const project = createProject("project_api", "API");
  const workflow = createWorkflow(project.project_id, "wf_api", "plan_api");
  const state = createState("wf_other", workflow.plan_id);

  assert.throws(
    () => buildGlobalTaskQueue([{ project, workflow, state }]),
    (error) => error instanceof TaskGraphSchedulerError
      && error.code === "GLOBAL_QUEUE_WORKFLOW_MISMATCH"
  );
});
