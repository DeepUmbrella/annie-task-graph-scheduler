import type { AuditEvent } from "../models/audit.js";
import type { TaskStatus } from "../models/task.js";
import type { Wave } from "../models/wave.js";
import type { WorkflowState } from "../models/workflow.js";
import { resolveDependencies, type TaskStatusChange } from "../scheduler/dependency_resolver.js";
import { generateNextWave } from "../scheduler/scheduler.js";
import { createStateStore, type StateStore } from "../storage/state_store.js";
import type {
  WorkflowSchedulingDecision,
  WorkflowSchedulingInput,
  WorkflowSchedulingResult
} from "./model.js";

export interface ScheduleNextWaveOptions {
  rootDir?: string;
  stateStore?: StateStore;
  now?: string;
}

export async function scheduleNextWorkflowWave(
  input: WorkflowSchedulingInput,
  options: ScheduleNextWaveOptions = {}
): Promise<WorkflowSchedulingResult> {
  const now = options.now ?? new Date().toISOString();
  const stateStore = options.stateStore ?? createStateStore(options.rootDir);
  const state = await stateStore.loadState(input.workflow_id);
  const activeWave = findActiveWave(state);

  if (activeWave) {
    const decision = createDecision(state, {
      status: "active_wave",
      reason: `Workflow already has active wave ${activeWave.id}.`,
      waveId: activeWave.id
    });
    await stateStore.appendAuditEvent(createSchedulingAuditEvent(state.workflow_id, "WORKFLOW_SCHEDULING_SKIPPED", now, {
      decision
    }));

    return createResult(state, stateStore, decision, [], null);
  }

  if (isWorkflowCompleted(state)) {
    const completedState: WorkflowState = state.status === "done" ? state : {
      ...state,
      status: "done",
      updated_at: now
    };
    const decision = createDecision(completedState, {
      status: "completed",
      reason: "All workflow tasks are done."
    });

    if (completedState !== state) {
      await stateStore.saveState(completedState);
    }
    await stateStore.appendAuditEvent(createSchedulingAuditEvent(state.workflow_id, "WORKFLOW_SCHEDULING_SKIPPED", now, {
      decision
    }));

    return createResult(completedState, stateStore, decision, [], null);
  }

  if (state.status === "failed") {
    const decision = createDecision(state, {
      status: "failed",
      reason: "Workflow status is failed."
    });
    await stateStore.appendAuditEvent(createSchedulingAuditEvent(state.workflow_id, "WORKFLOW_SCHEDULING_SKIPPED", now, {
      decision
    }));

    return createResult(state, stateStore, decision, [], null);
  }

  const dependencyResolution = resolveDependencies(state);
  const nextWave = generateNextWave(dependencyResolution.state);

  if (!nextWave.wave) {
    const nextState: WorkflowState = {
      ...dependencyResolution.state,
      updated_at: now
    };
    const decision = createDecision(nextState, {
      status: "no_ready_tasks",
      reason: nextWave.ready_task_ids.length > 0
        ? "Ready tasks exist but scheduling policy skipped them."
        : "No ready tasks are available for scheduling."
    });

    await stateStore.saveState(nextState);
    await appendSchedulingAuditEvents(stateStore, nextState, now, dependencyResolution.status_changes, {
      type: "WORKFLOW_SCHEDULING_SKIPPED",
      payload: {
        decision,
        scheduler_decision: nextWave.decision,
        skipped_ready_tasks: nextWave.skipped_ready_tasks
      }
    });

    return createResult(nextState, stateStore, decision, dependencyResolution.status_changes, nextWave);
  }

  const nextState: WorkflowState = {
    ...dependencyResolution.state,
    current_wave: nextWave.wave.id,
    status: "running",
    waves: [...dependencyResolution.state.waves, nextWave.wave],
    updated_at: now
  };
  const decision = createDecision(nextState, {
    status: "scheduled",
    reason: nextWave.wave.reason,
    waveId: nextWave.wave.id
  });

  await stateStore.saveState(nextState);
  await appendSchedulingAuditEvents(stateStore, nextState, now, dependencyResolution.status_changes, {
    type: "WORKFLOW_WAVE_SCHEDULED",
    payload: {
      decision,
      wave_id: nextWave.wave.id,
      task_ids: nextWave.wave.tasks,
      scheduler_decision: nextWave.decision,
      skipped_ready_tasks: nextWave.skipped_ready_tasks
    }
  });

  return createResult(nextState, stateStore, decision, dependencyResolution.status_changes, nextWave);
}

function createResult(
  state: WorkflowState,
  stateStore: StateStore,
  decision: WorkflowSchedulingDecision,
  statusChanges: TaskStatusChange[],
  nextWave: WorkflowSchedulingResult["next_wave"]
): WorkflowSchedulingResult {
  return {
    workflow_id: state.workflow_id,
    decision,
    status_changes: statusChanges,
    state,
    next_wave: nextWave,
    state_path: stateStore.statePath(state.workflow_id),
    audit_path: stateStore.auditPath(state.workflow_id)
  };
}

function findActiveWave(state: WorkflowState): Wave | null {
  if (state.current_wave) {
    const current = state.waves.find((wave) => wave.id === state.current_wave);
    if (current && isActiveWaveStatus(current.status)) {
      return current;
    }
  }

  return state.waves.find((wave) => isActiveWaveStatus(wave.status)) ?? null;
}

function isActiveWaveStatus(status: Wave["status"]): boolean {
  return status === "pending" || status === "running" || status === "reviewing";
}

function isWorkflowCompleted(state: WorkflowState): boolean {
  return Object.values(state.tasks).length > 0
    && Object.values(state.tasks).every((task) => task.status === "done");
}

function createDecision(
  state: WorkflowState,
  options: {
    status: WorkflowSchedulingDecision["status"];
    reason: string;
    waveId?: string;
  }
): WorkflowSchedulingDecision {
  return {
    status: options.status,
    reason: options.reason,
    workflow_id: state.workflow_id,
    wave_id: options.waveId,
    ready_task_ids: taskIdsByStatus(state, "ready"),
    blocked_task_ids: taskIdsByStatus(state, "blocked"),
    pending_task_ids: taskIdsByStatus(state, "pending"),
    completed_task_ids: taskIdsByStatus(state, "done"),
    failed_task_ids: taskIdsByStatus(state, "failed")
  };
}

function taskIdsByStatus(state: WorkflowState, status: TaskStatus): string[] {
  return Object.values(state.tasks)
    .filter((task) => task.status === status)
    .map((task) => task.id);
}

async function appendSchedulingAuditEvents(
  stateStore: StateStore,
  state: WorkflowState,
  now: string,
  statusChanges: TaskStatusChange[],
  schedulingEvent: Pick<AuditEvent, "type" | "payload">
): Promise<void> {
  for (const change of statusChanges) {
    await stateStore.appendAuditEvent(createSchedulingAuditEvent(state.workflow_id, "TASK_STATUS_CHANGED", now, {
      task_id: change.task_id,
      from: change.from,
      to: change.to,
      reason: change.reason,
      source: "dependency_resolver"
    }));
  }

  await stateStore.appendAuditEvent(createSchedulingAuditEvent(state.workflow_id, schedulingEvent.type, now, schedulingEvent.payload));
}

function createSchedulingAuditEvent(
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
