import { readFile } from "node:fs/promises";
import { defaultExecutionPolicy, type ExecutionPolicy, type ExecutionPolicyInput, type TaskDagPlan } from "../models/plan.js";
import type { PlanTaskInput, Task } from "../models/task.js";
import type { WorkflowState } from "../models/workflow.js";
import { TaskGraphSchedulerError } from "../errors.js";
import { validateDag } from "./dag_validator.js";

export interface LoadedPlan {
  plan: TaskDagPlan;
  execution_policy: ExecutionPolicy;
}

export async function loadPlanFile(path: string): Promise<LoadedPlan> {
  let raw: string;

  try {
    raw = await readFile(path, "utf8");
  } catch (error) {
    throw new TaskGraphSchedulerError("Failed to read plan file.", "PLAN_READ_FAILED", {
      path,
      cause: error instanceof Error ? error.message : String(error)
    });
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new TaskGraphSchedulerError("Plan file is not valid JSON.", "PLAN_JSON_INVALID", {
      path,
      cause: error instanceof Error ? error.message : String(error)
    });
  }

  return loadPlan(parsed);
}

export function loadPlan(input: unknown): LoadedPlan {
  const validation = validateDag(input);

  if (!validation.valid) {
    throw new TaskGraphSchedulerError("Task DAG plan is invalid.", "PLAN_VALIDATION_FAILED", {
      errors: validation.errors
    });
  }

  const plan = input as TaskDagPlan;

  return {
    plan,
    execution_policy: normalizeExecutionPolicy(plan.execution_policy)
  };
}

export function normalizeExecutionPolicy(policy: ExecutionPolicyInput = {}): ExecutionPolicy {
  const merged: ExecutionPolicy = {
    ...defaultExecutionPolicy,
    ...policy,
    scheduling: {
      ...defaultExecutionPolicy.scheduling,
      ...policy.scheduling
    },
    agents: {
      ...defaultExecutionPolicy.agents,
      ...policy.agents
    },
    risk: {
      ...defaultExecutionPolicy.risk,
      ...policy.risk,
      scoring_weights: {
        ...defaultExecutionPolicy.risk.scoring_weights,
        ...policy.risk?.scoring_weights
      }
    },
    retry: {
      ...defaultExecutionPolicy.retry,
      ...policy.retry
    },
    conflicts: {
      ...defaultExecutionPolicy.conflicts,
      ...policy.conflicts
    }
  };

  return {
    ...merged,
    max_retries: merged.retry.max_retries,
    retry_on: merged.retry.retry_on,
    manual_review_on_second_failure: merged.retry.manual_review_on_second_failure
  };
}

export function createInitialWorkflowState(
  workflowId: string,
  loadedPlan: LoadedPlan,
  now = new Date().toISOString()
): WorkflowState {
  const tasks = Object.fromEntries(
    loadedPlan.plan.tasks.map((task) => [task.id, normalizePlanTask(task, now)])
  );

  return {
    workflow_id: workflowId,
    plan_id: loadedPlan.plan.plan_id,
    current_wave: null,
    status: "pending",
    execution_policy: loadedPlan.execution_policy,
    tasks,
    waves: [],
    agents: {},
    created_at: now,
    updated_at: now
  };
}

function normalizePlanTask(task: PlanTaskInput, now: string): Task {
  return {
    id: task.id,
    title: task.title,
    description: task.description ?? "",
    depends_on: task.depends_on ?? [],
    status: "pending",
    can_parallel: task.can_parallel ?? true,
    risk: task.risk ?? "low",
    expected_files: task.expected_files ?? [],
    required_capabilities: task.required_capabilities ?? [],
    changed_files: [],
    tests_run: [],
    risks_found: [],
    result_summary: null,
    failure_type: null,
    failure_reason: null,
    next_recommendation: null,
    preferred_agent: task.preferred_agent ?? null,
    assigned_to: null,
    retry_count: 0,
    created_at: now,
    started_at: null,
    completed_at: null
  };
}
