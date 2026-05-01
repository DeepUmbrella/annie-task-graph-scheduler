import type { AuditEvent } from "../models/audit.js";
import type { WorkflowState } from "../models/workflow.js";
import { TaskGraphSchedulerError } from "../errors.js";
import { collectResult, validateWorkerTaskResult } from "../execution/result_collector.js";
import { createStateStore, type StateStore } from "../storage/state_store.js";
import type { ResultIntakeInput, ResultIntakeResult } from "./model.js";

export interface IntakeAgentResultOptions {
  rootDir?: string;
  stateStore?: StateStore;
  now?: string;
}

export async function intakeAgentResult(
  input: ResultIntakeInput,
  options: IntakeAgentResultOptions = {}
): Promise<ResultIntakeResult> {
  const now = options.now ?? new Date().toISOString();
  const stateStore = options.stateStore ?? createStateStore(options.rootDir);
  const submittedResult = validateWorkerTaskResult(input.result);
  const state = await stateStore.loadState(input.workflow_id);
  const task = state.tasks[submittedResult.task_id];

  if (!task) {
    throw new TaskGraphSchedulerError("Result references a missing task.", "RESULT_TASK_NOT_FOUND", {
      workflow_id: input.workflow_id,
      task_id: submittedResult.task_id
    });
  }

  const waveId = input.wave_id ?? findWaveIdForTask(state, submittedResult.task_id);

  if (!waveId) {
    throw new TaskGraphSchedulerError("Result task is not part of a workflow wave.", "RESULT_WAVE_NOT_FOUND", {
      workflow_id: input.workflow_id,
      task_id: submittedResult.task_id
    });
  }

  if (task.assigned_to !== input.from) {
    throw new TaskGraphSchedulerError("Result sender is not assigned to this task.", "RESULT_SENDER_NOT_ASSIGNED", {
      workflow_id: input.workflow_id,
      task_id: submittedResult.task_id,
      from: input.from,
      assigned_to: task.assigned_to
    });
  }

  if (task.status !== "assigned" && task.status !== "running") {
    throw new TaskGraphSchedulerError("Only assigned or running tasks can accept agent results.", "TASK_NOT_ACCEPTING_RESULT", {
      workflow_id: input.workflow_id,
      task_id: submittedResult.task_id,
      status: task.status
    });
  }

  const collectionState = task.status === "assigned"
    ? markAssignedTaskRunning(state, submittedResult.task_id, now)
    : state;
  const collection = collectResult(collectionState, submittedResult, now);
  const auditEvents = [
    createResultIntakeAuditEvent(state.workflow_id, "AGENT_RESULT_SUBMITTED", now, {
      task_id: submittedResult.task_id,
      wave_id: waveId,
      from: input.from,
      result: submittedResult
    }),
    ...(task.status === "assigned" ? [createResultIntakeAuditEvent(state.workflow_id, "TASK_STATUS_CHANGED", now, {
      task_id: submittedResult.task_id,
      from: "assigned",
      to: "running",
      reason: "Result intake implicitly acknowledged assigned work.",
      source: "result_intake"
    })] : []),
    ...collection.audit_events
  ];

  await stateStore.saveState(collection.state);
  for (const event of auditEvents) {
    await stateStore.appendAuditEvent(event);
  }

  const nextTask = collection.state.tasks[submittedResult.task_id];

  return {
    workflow_id: collection.state.workflow_id,
    task_id: submittedResult.task_id,
    wave_id: waveId,
    from: input.from,
    decision: {
      status: "accepted",
      reason: `Result accepted from ${input.from}.`,
      workflow_id: collection.state.workflow_id,
      task_id: submittedResult.task_id,
      wave_id: waveId,
      from: input.from,
      result_status: submittedResult.status,
      next_task_status: nextTask?.status
    },
    submitted_result: submittedResult,
    state: collection.state,
    state_path: stateStore.statePath(collection.state.workflow_id),
    audit_path: stateStore.auditPath(collection.state.workflow_id)
  };
}

function findWaveIdForTask(state: WorkflowState, taskId: string): string | null {
  return state.waves.find((wave) => wave.tasks.includes(taskId))?.id ?? null;
}

function markAssignedTaskRunning(state: WorkflowState, taskId: string, now: string): WorkflowState {
  const task = state.tasks[taskId];

  if (!task) {
    return state;
  }

  return {
    ...state,
    tasks: {
      ...state.tasks,
      [taskId]: {
        ...task,
        status: "running",
        started_at: task.started_at ?? now
      }
    },
    agents: {
      ...state.agents,
      ...(task.assigned_to ? {
        [task.assigned_to]: {
          ...(state.agents[task.assigned_to] ?? {
            agent_id: task.assigned_to,
            capabilities: [],
            active_task_ids: [],
            max_concurrent_tasks: state.execution_policy.agents.max_tasks_per_agent,
            session_id: null,
            status: "idle" as const
          }),
          active_task_ids: [
            ...new Set([
              ...(state.agents[task.assigned_to]?.active_task_ids ?? []),
              taskId
            ])
          ],
          status: "busy" as const
        }
      } : {})
    },
    updated_at: now
  };
}

function createResultIntakeAuditEvent(
  workflowId: string,
  type: string,
  now: string,
  payload: Record<string, unknown>
): AuditEvent {
  return {
    event_id: `evt_${Date.parse(now)}_${type.toLowerCase()}_${Math.random().toString(36).slice(2, 10)}`,
    workflow_id: workflowId,
    type,
    payload,
    created_at: now
  };
}
