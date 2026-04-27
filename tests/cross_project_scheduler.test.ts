import test from "node:test";
import assert from "node:assert/strict";
import {
  TaskGraphSchedulerError,
  buildGlobalAgentPool,
  buildGlobalTaskQueue,
  canGlobalAgentRunTask,
  planCrossProjectDispatch
} from "../src/index.js";
import type { GlobalAgentRuntimeState, GlobalTaskQueueItem, ProjectRef, ProjectWorkflowRef, WorkflowState } from "../src/index.js";
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

function createAgent(agentId: string, capabilities: string[], activeGlobalTaskIds: string[] = []): GlobalAgentRuntimeState {
  return {
    agent_id: agentId,
    capabilities,
    active_task_ids: [],
    max_concurrent_tasks: 1,
    session_id: null,
    status: activeGlobalTaskIds.length > 0 ? "busy" : "idle",
    project_ids: [],
    workflow_ids: [],
    active_global_task_ids: activeGlobalTaskIds,
    capacity_remaining: Math.max(0, 1 - activeGlobalTaskIds.length)
  };
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

test("planCrossProjectDispatch orders by user priority then project priority", () => {
  const lowProjectItem: GlobalTaskQueueItem = {
    id: "project_low:wf:T1",
    project_id: "project_low",
    project_name: "Low",
    workflow_id: "wf",
    plan_id: "plan",
    task_id: "T1",
    title: "Low project",
    status: "ready",
    project_priority: "low",
    user_priority: "urgent",
    risk: "low",
    risk_score: 10,
    risk_reasons: [],
    expected_files: [],
    required_capabilities: ["backend"],
    preferred_agent: null,
    retry_count: 0,
    created_at: "2026-04-27T00:00:00.000Z"
  };
  const highProjectItem: GlobalTaskQueueItem = {
    ...lowProjectItem,
    id: "project_high:wf:T2",
    project_id: "project_high",
    project_name: "High",
    task_id: "T2",
    project_priority: "urgent",
    user_priority: "normal"
  };
  const focusProjectItem: GlobalTaskQueueItem = {
    ...lowProjectItem,
    id: "project_focus:wf:T3",
    project_id: "project_focus",
    project_name: "Focus",
    task_id: "T3",
    project_priority: "high",
    user_priority: "focus"
  };

  const plan = planCrossProjectDispatch(
    [highProjectItem, focusProjectItem, lowProjectItem],
    [
      { ...createAgent("agent-a", ["backend"]), max_concurrent_tasks: 3, capacity_remaining: 3 }
    ]
  );

  assert.deepEqual(plan.assignments.map((assignment) => assignment.global_task_id), [
    "project_low:wf:T1",
    "project_focus:wf:T3",
    "project_high:wf:T2"
  ]);
  assert.deepEqual(plan.skipped, []);
});

test("planCrossProjectDispatch skips tasks when capable agent is full", () => {
  const item: GlobalTaskQueueItem = {
    id: "project_api:wf_api:T_ready",
    project_id: "project_api",
    project_name: "API",
    workflow_id: "wf_api",
    plan_id: "plan_api",
    task_id: "T_ready",
    title: "Ready task",
    status: "ready",
    project_priority: "high",
    user_priority: "focus",
    risk: "low",
    risk_score: 10,
    risk_reasons: [],
    expected_files: [],
    required_capabilities: ["backend"],
    preferred_agent: "backend-agent",
    retry_count: 0,
    created_at: "2026-04-27T00:00:00.000Z"
  };

  const plan = planCrossProjectDispatch([item], [
    createAgent("backend-agent", ["backend"], ["existing:task"])
  ]);

  assert.deepEqual(plan.assignments, []);
  assert.equal(plan.skipped[0]?.category, "agent_capacity");
  assert.match(plan.skipped[0]?.reason ?? "", /no online capable agent/);
});

test("planCrossProjectDispatch simulates capacity without mutating inputs", () => {
  const project = createProject("project_api", "API");
  const workflow = createWorkflow(project.project_id, "wf_api", "plan_api");
  const state = createState(workflow.workflow_id, workflow.plan_id);
  state.tasks.T_ready!.status = "ready";
  const stateBefore = JSON.stringify(state);
  const queue = buildGlobalTaskQueue([{ project, workflow, state }]).items;
  const agents = [
    { ...createAgent("backend-agent", ["backend"]), max_concurrent_tasks: 2, capacity_remaining: 2 }
  ];
  const agentsBefore = JSON.stringify(agents);

  const plan = planCrossProjectDispatch(queue, agents);

  assert.deepEqual(plan.assignments.map((assignment) => assignment.assigned_to), ["backend-agent"]);
  assert.equal(JSON.stringify(state), stateBefore);
  assert.equal(JSON.stringify(agents), agentsBefore);
  assert.equal(plan.decision.agent_load_summary[0]?.planned_task_count, 1);
});

test("buildGlobalAgentPool merges same named agents across workflows", () => {
  const pool = buildGlobalAgentPool([
    {
      project_id: "project_api",
      workflow_id: "wf_api",
      agents: {
        "shared-agent": {
          agent_id: "shared-agent",
          capabilities: ["backend"],
          active_task_ids: ["T1"],
          max_concurrent_tasks: 2,
          session_id: "session_api",
          status: "busy"
        }
      }
    },
    {
      project_id: "project_docs",
      workflow_id: "wf_docs",
      agents: {
        "shared-agent": {
          agent_id: "shared-agent",
          capabilities: ["writing"],
          active_task_ids: ["T2"],
          max_concurrent_tasks: 2,
          session_id: "session_docs",
          status: "idle"
        },
        "offline-agent": {
          agent_id: "offline-agent",
          capabilities: ["backend"],
          active_task_ids: [],
          max_concurrent_tasks: 1,
          session_id: null,
          status: "offline"
        }
      }
    }
  ]);

  assert.equal(pool.totals.total_agents, 2);
  assert.equal(pool.totals.max_concurrent_tasks, 5);
  assert.equal(pool.totals.active_global_task_count, 2);
  assert.equal(pool.totals.capacity_remaining, 2);

  const sharedAgent = pool.agents.find((agent) => agent.agent_id === "shared-agent");
  assert.deepEqual(sharedAgent?.capabilities, ["backend", "writing"]);
  assert.deepEqual(sharedAgent?.project_ids, ["project_api", "project_docs"]);
  assert.deepEqual(sharedAgent?.workflow_ids, ["wf_api", "wf_docs"]);
  assert.deepEqual(sharedAgent?.active_global_task_ids, [
    "project_api:wf_api:T1",
    "project_docs:wf_docs:T2"
  ]);
  assert.equal(sharedAgent?.max_concurrent_tasks, 4);
  assert.equal(sharedAgent?.capacity_remaining, 2);
  assert.equal(sharedAgent?.status, "busy");
});

test("canGlobalAgentRunTask follows worker pool capability and capacity semantics", () => {
  const onlineAgent = createAgent("backend-agent", ["backend"]);
  const offlineAgent = { ...createAgent("offline-agent", ["backend"]), status: "offline" as const };
  const fullAgent = createAgent("full-agent", ["backend"], ["project:wf:T1"]);

  assert.equal(canGlobalAgentRunTask(onlineAgent, { required_capabilities: ["backend"] }), true);
  assert.equal(canGlobalAgentRunTask(onlineAgent, { required_capabilities: ["frontend"] }), false);
  assert.equal(canGlobalAgentRunTask(offlineAgent, { required_capabilities: ["backend"] }), false);
  assert.equal(canGlobalAgentRunTask(fullAgent, { required_capabilities: ["backend"] }), false);
});
