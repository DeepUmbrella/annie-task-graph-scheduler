import type { AuditEvent } from "../models/audit.js";
import type { Wave } from "../models/wave.js";
import type { WorkflowState } from "../models/workflow.js";
import { TaskGraphSchedulerError } from "../errors.js";

export interface WorkerAssignment {
  task_id: string;
  assigned_to: string;
}

export interface WorkerAssignmentResult {
  state: WorkflowState;
  assignments: WorkerAssignment[];
  audit_events: AuditEvent[];
}

export interface WorkerPoolOptions {
  now?: string;
  default_agent?: string;
}

export function assignWorkers(
  state: WorkflowState,
  wave: Wave,
  options: WorkerPoolOptions = {}
): WorkerAssignmentResult {
  const now = options.now ?? new Date().toISOString();
  const defaultAgent = options.default_agent ?? "default-agent";
  const tasks = { ...state.tasks };
  const assignments: WorkerAssignment[] = [];
  const auditEvents: AuditEvent[] = [];

  for (const taskId of wave.tasks) {
    const task = tasks[taskId];

    if (!task) {
      throw new TaskGraphSchedulerError("Wave references a missing task.", "WAVE_TASK_NOT_FOUND", {
        workflow_id: state.workflow_id,
        wave_id: wave.id,
        task_id: taskId
      });
    }

    if (task.status !== "ready") {
      throw new TaskGraphSchedulerError("Only ready tasks can be assigned to workers.", "TASK_NOT_READY_FOR_ASSIGNMENT", {
        workflow_id: state.workflow_id,
        wave_id: wave.id,
        task_id: taskId,
        status: task.status
      });
    }

    const assignedTo = task.preferred_agent ?? defaultAgent;
    tasks[taskId] = {
      ...task,
      status: "running",
      assigned_to: assignedTo,
      started_at: now
    };
    assignments.push({
      task_id: taskId,
      assigned_to: assignedTo
    });
    auditEvents.push(createAuditEvent(state.workflow_id, "WORKER_ASSIGNED", now, {
      task_id: taskId,
      wave_id: wave.id,
      assigned_to: assignedTo
    }));
    auditEvents.push(createAuditEvent(state.workflow_id, "TASK_STATUS_CHANGED", now, {
      task_id: taskId,
      from: "ready",
      to: "running"
    }));
  }

  const nextWave: Wave = {
    ...wave,
    status: "running",
    started_at: wave.started_at ?? now
  };
  const existingWave = state.waves.find((candidate) => candidate.id === wave.id);
  const waves = existingWave
    ? state.waves.map((candidate) => candidate.id === wave.id ? nextWave : candidate)
    : [...state.waves, nextWave];

  return {
    state: {
      ...state,
      status: "running",
      current_wave: wave.id,
      tasks,
      waves,
      updated_at: now
    },
    assignments,
    audit_events: auditEvents
  };
}

function createAuditEvent(
  workflowId: string,
  type: string,
  now: string,
  payload: Record<string, unknown>
): AuditEvent {
  return {
    event_id: `evt_${Date.parse(now)}_${Math.random().toString(36).slice(2, 10)}`,
    workflow_id: workflowId,
    type,
    payload,
    created_at: now
  };
}
