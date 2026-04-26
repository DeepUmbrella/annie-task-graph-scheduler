import type { AuditEvent } from "../models/audit.js";
import type { TaskStatus } from "../models/task.js";
import type { WorkflowState } from "../models/workflow.js";
import { TaskGraphSchedulerError } from "../errors.js";

export interface WorkerTaskResult {
  task_id: string;
  status: "completed" | "failed";
  summary: string;
  changed_files?: string[];
  tests_run?: string[];
  risks?: string[];
  next_recommendation?: string;
  failure_type?: string;
  failure_reason?: string;
}

export interface ResultCollectionResult {
  state: WorkflowState;
  audit_events: AuditEvent[];
}

export function collectResult(
  state: WorkflowState,
  result: unknown,
  now = new Date().toISOString()
): ResultCollectionResult {
  const parsedResult = validateWorkerTaskResult(result);
  const task = state.tasks[parsedResult.task_id];

  if (!task) {
    throw new TaskGraphSchedulerError("Result references a missing task.", "RESULT_TASK_NOT_FOUND", {
      workflow_id: state.workflow_id,
      task_id: parsedResult.task_id
    });
  }

  if (task.status !== "running") {
    throw new TaskGraphSchedulerError("Only running tasks can accept worker results.", "TASK_NOT_RUNNING_FOR_RESULT", {
      workflow_id: state.workflow_id,
      task_id: parsedResult.task_id,
      status: task.status
    });
  }

  const nextStatus: TaskStatus = parsedResult.status === "completed" ? "reviewing" : "failed";
  const nextTask = {
    ...task,
    status: nextStatus,
    changed_files: parsedResult.changed_files ?? [],
    tests_run: parsedResult.tests_run ?? [],
    risks_found: parsedResult.risks ?? [],
    result_summary: parsedResult.summary,
    failure_type: parsedResult.status === "failed" ? parsedResult.failure_type ?? "unknown" : null,
    failure_reason: parsedResult.status === "failed" ? parsedResult.failure_reason ?? parsedResult.summary : null,
    next_recommendation: parsedResult.next_recommendation ?? null,
    completed_at: now
  };

  return {
    state: {
      ...state,
      tasks: {
        ...state.tasks,
        [parsedResult.task_id]: nextTask
      },
      updated_at: now
    },
    audit_events: [
      {
        event_id: `evt_${Date.parse(now)}_${Math.random().toString(36).slice(2, 10)}`,
        workflow_id: state.workflow_id,
        type: "TASK_RESULT_COLLECTED",
        payload: {
          task_id: parsedResult.task_id,
          result_status: parsedResult.status
        },
        created_at: now
      },
      {
        event_id: `evt_${Date.parse(now)}_${Math.random().toString(36).slice(2, 10)}`,
        workflow_id: state.workflow_id,
        type: "TASK_STATUS_CHANGED",
        payload: {
          task_id: parsedResult.task_id,
          from: "running",
          to: nextStatus
        },
        created_at: now
      }
    ]
  };
}

export function validateWorkerTaskResult(input: unknown): WorkerTaskResult {
  if (!isRecord(input)) {
    throw new TaskGraphSchedulerError("Worker result must be an object.", "WORKER_RESULT_INVALID");
  }

  if (!isNonEmptyString(input.task_id)) {
    throw new TaskGraphSchedulerError("Worker result task_id is required.", "WORKER_RESULT_INVALID");
  }

  if (input.status !== "completed" && input.status !== "failed") {
    throw new TaskGraphSchedulerError("Worker result status must be completed or failed.", "WORKER_RESULT_INVALID");
  }

  if (!isNonEmptyString(input.summary)) {
    throw new TaskGraphSchedulerError("Worker result summary is required.", "WORKER_RESULT_INVALID");
  }

  if (input.changed_files !== undefined && !isStringArray(input.changed_files)) {
    throw new TaskGraphSchedulerError("Worker result changed_files must be an array of strings.", "WORKER_RESULT_INVALID");
  }

  if (input.tests_run !== undefined && !isStringArray(input.tests_run)) {
    throw new TaskGraphSchedulerError("Worker result tests_run must be an array of strings.", "WORKER_RESULT_INVALID");
  }

  if (input.risks !== undefined && !isStringArray(input.risks)) {
    throw new TaskGraphSchedulerError("Worker result risks must be an array of strings.", "WORKER_RESULT_INVALID");
  }

  if (input.status === "failed" && input.failure_type !== undefined && typeof input.failure_type !== "string") {
    throw new TaskGraphSchedulerError("Worker result failure_type must be a string when provided.", "WORKER_RESULT_INVALID");
  }

  if (input.status === "failed" && input.failure_reason !== undefined && typeof input.failure_reason !== "string") {
    throw new TaskGraphSchedulerError("Worker result failure_reason must be a string when provided.", "WORKER_RESULT_INVALID");
  }

  return input as unknown as WorkerTaskResult;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}
