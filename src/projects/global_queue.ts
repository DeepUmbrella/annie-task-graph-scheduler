import { TaskGraphSchedulerError } from "../errors.js";
import type { GlobalTaskQueueItem, ProjectRef, ProjectWorkflowRef } from "../models/project.js";
import type { WorkflowState } from "../models/workflow.js";
import { scoreTaskRisk } from "../scheduler/risk_scorer.js";

export interface GlobalQueueWorkflowInput {
  project: ProjectRef;
  workflow: ProjectWorkflowRef;
  state: WorkflowState;
}

export interface GlobalQueueBuildResult {
  items: GlobalTaskQueueItem[];
  skipped: GlobalQueueSkippedTask[];
}

export interface GlobalQueueSkippedTask {
  project_id: string;
  workflow_id: string;
  task_id: string;
  status: string;
  reason: string;
}

export function buildGlobalTaskQueue(inputs: GlobalQueueWorkflowInput[]): GlobalQueueBuildResult {
  const items: GlobalTaskQueueItem[] = [];
  const skipped: GlobalQueueSkippedTask[] = [];

  for (const input of inputs) {
    validateInput(input);

    for (const task of Object.values(input.state.tasks)) {
      if (task.status !== "ready") {
        skipped.push({
          project_id: input.project.project_id,
          workflow_id: input.workflow.workflow_id,
          task_id: task.id,
          status: task.status,
          reason: `Task is ${task.status}, not ready.`
        });
        continue;
      }

      const riskScore = scoreTaskRisk(task, input.state.execution_policy.risk);
      items.push({
        id: createGlobalTaskId(input.project.project_id, input.workflow.workflow_id, task.id),
        project_id: input.project.project_id,
        project_name: input.project.name,
        workflow_id: input.workflow.workflow_id,
        plan_id: input.workflow.plan_id,
        task_id: task.id,
        title: task.title,
        status: "ready",
        project_priority: input.project.priority,
        user_priority: input.workflow.priority,
        risk: task.risk,
        risk_score: riskScore.score,
        risk_reasons: riskScore.reasons,
        expected_files: task.expected_files,
        required_capabilities: task.required_capabilities,
        preferred_agent: task.preferred_agent,
        retry_count: task.retry_count,
        created_at: task.created_at
      });
    }
  }

  return {
    items: sortGlobalTaskQueue(items),
    skipped: sortSkippedTasks(skipped)
  };
}

export function createGlobalTaskId(projectId: string, workflowId: string, taskId: string): string {
  return `${projectId}:${workflowId}:${taskId}`;
}

function validateInput(input: GlobalQueueWorkflowInput): void {
  if (input.project.project_id !== input.workflow.project_id) {
    throw new TaskGraphSchedulerError("Project and workflow registry references do not match.", "GLOBAL_QUEUE_PROJECT_MISMATCH", {
      project_id: input.project.project_id,
      workflow_project_id: input.workflow.project_id,
      workflow_id: input.workflow.workflow_id
    });
  }

  if (input.workflow.workflow_id !== input.state.workflow_id) {
    throw new TaskGraphSchedulerError("Workflow registry reference and workflow state do not match.", "GLOBAL_QUEUE_WORKFLOW_MISMATCH", {
      workflow_id: input.workflow.workflow_id,
      state_workflow_id: input.state.workflow_id
    });
  }

  if (input.workflow.plan_id !== input.state.plan_id) {
    throw new TaskGraphSchedulerError("Workflow registry reference and workflow state plan do not match.", "GLOBAL_QUEUE_PLAN_MISMATCH", {
      workflow_id: input.workflow.workflow_id,
      plan_id: input.workflow.plan_id,
      state_plan_id: input.state.plan_id
    });
  }
}

function sortGlobalTaskQueue(items: GlobalTaskQueueItem[]): GlobalTaskQueueItem[] {
  return [...items].sort((a, b) => {
    const projectComparison = a.project_id.localeCompare(b.project_id);
    if (projectComparison !== 0) {
      return projectComparison;
    }

    const workflowComparison = a.workflow_id.localeCompare(b.workflow_id);
    if (workflowComparison !== 0) {
      return workflowComparison;
    }

    return a.task_id.localeCompare(b.task_id);
  });
}

function sortSkippedTasks(skipped: GlobalQueueSkippedTask[]): GlobalQueueSkippedTask[] {
  return [...skipped].sort((a, b) => {
    const projectComparison = a.project_id.localeCompare(b.project_id);
    if (projectComparison !== 0) {
      return projectComparison;
    }

    const workflowComparison = a.workflow_id.localeCompare(b.workflow_id);
    if (workflowComparison !== 0) {
      return workflowComparison;
    }

    return a.task_id.localeCompare(b.task_id);
  });
}
