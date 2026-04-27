import test from "node:test";
import assert from "node:assert/strict";
import { projectPriorities, userPriorities } from "../src/index.js";
import type { GlobalAgentRuntimeState, GlobalTaskQueueItem, ProjectRef, ProjectWorkflowRef } from "../src/index.js";

test("constructs cross-project scheduling models", () => {
  const project: ProjectRef = {
    project_id: "project_docs",
    name: "Docs",
    root_path: "/workspace/docs",
    priority: "high",
    tags: ["writing"],
    created_at: "2026-04-27T00:00:00.000Z",
    updated_at: "2026-04-27T00:00:00.000Z"
  };

  const workflow: ProjectWorkflowRef = {
    project_id: project.project_id,
    workflow_id: "wf_docs",
    plan_id: "plan_docs",
    state_path: ".annie/workflows/wf_docs/state.json",
    status: "running",
    priority: "focus",
    registered_at: "2026-04-27T00:00:00.000Z",
    updated_at: "2026-04-27T00:00:00.000Z"
  };

  const queueItem: GlobalTaskQueueItem = {
    id: "project_docs:wf_docs:T001",
    project_id: project.project_id,
    project_name: project.name,
    workflow_id: workflow.workflow_id,
    plan_id: workflow.plan_id,
    task_id: "T001",
    title: "Draft chapter",
    status: "ready",
    project_priority: project.priority,
    user_priority: workflow.priority,
    risk: "medium",
    risk_score: 31,
    risk_reasons: ["explicit risk medium", "1 expected file(s)"],
    expected_files: ["docs/chapter.md"],
    required_capabilities: ["writing"],
    preferred_agent: "writer-agent",
    retry_count: 0,
    created_at: "2026-04-27T00:01:00.000Z"
  };

  const agent: GlobalAgentRuntimeState = {
    agent_id: "writer-agent",
    capabilities: ["writing"],
    active_task_ids: ["T001"],
    max_concurrent_tasks: 2,
    session_id: "session_writer",
    status: "busy",
    project_ids: [project.project_id],
    workflow_ids: [workflow.workflow_id],
    active_global_task_ids: [queueItem.id],
    capacity_remaining: 1
  };

  assert.equal(queueItem.project_id, project.project_id);
  assert.equal(queueItem.workflow_id, workflow.workflow_id);
  assert.equal(queueItem.task_id, "T001");
  assert.equal(queueItem.project_priority, "high");
  assert.equal(queueItem.user_priority, "focus");
  assert.deepEqual(queueItem.required_capabilities, ["writing"]);
  assert.equal(agent.capacity_remaining, 1);
});

test("exports stable priority values", () => {
  assert.deepEqual(projectPriorities, ["low", "normal", "high", "urgent"]);
  assert.deepEqual(userPriorities, ["background", "normal", "focus", "urgent"]);
});
