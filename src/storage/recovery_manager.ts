import type { AuditEvent } from "../models/audit.js";
import type { WorkflowState } from "../models/workflow.js";
import { resolveDependencies } from "../scheduler/dependency_resolver.js";
import type { StateStore } from "./state_store.js";

export interface RecoveryOptions {
  now?: string;
  running_task_policy?: "fail" | "ready";
  has_active_session?: (taskId: string, assignedTo: string | null) => boolean | Promise<boolean>;
}

export interface RecoveryResult {
  state: WorkflowState;
  audit_events: AuditEvent[];
  recovered_task_ids: string[];
}

export async function recoverWorkflow(
  store: StateStore,
  workflowId: string,
  options: RecoveryOptions = {}
): Promise<RecoveryResult> {
  const now = options.now ?? new Date().toISOString();
  const runningTaskPolicy = options.running_task_policy ?? "fail";
  const hasActiveSession = options.has_active_session ?? (() => false);
  const loadedState = await store.loadState(workflowId);
  let nextState: WorkflowState = {
    ...loadedState,
    tasks: Object.fromEntries(
      Object.entries(loadedState.tasks).map(([taskId, task]) => [taskId, { ...task }])
    ),
    waves: loadedState.waves.map((wave) => ({ ...wave })),
    updated_at: now
  };
  const auditEvents: AuditEvent[] = [];
  const recoveredTaskIds: string[] = [];

  for (const task of Object.values(nextState.tasks)) {
    if (task.status !== "running") {
      continue;
    }

    const active = await hasActiveSession(task.id, task.assigned_to);

    if (active) {
      continue;
    }

    const from = task.status;
    task.status = runningTaskPolicy === "ready" ? "ready" : "failed";
    task.failure_type = runningTaskPolicy === "ready" ? null : "unknown";
    task.failure_reason = runningTaskPolicy === "ready" ? null : "Session lost during recovery.";
    task.completed_at = runningTaskPolicy === "ready" ? task.completed_at : now;
    recoveredTaskIds.push(task.id);
    auditEvents.push(createRecoveryAuditEvent(workflowId, now, {
      task_id: task.id,
      from,
      to: task.status,
      reason: "Running task session was not active during recovery."
    }));
  }

  const dependencyResolution = resolveDependencies(nextState);
  nextState = {
    ...dependencyResolution.state,
    updated_at: now
  };

  for (const change of dependencyResolution.status_changes) {
    auditEvents.push(createRecoveryAuditEvent(workflowId, now, {
      task_id: change.task_id,
      from: change.from,
      to: change.to,
      reason: change.reason
    }));
  }

  await store.saveState(nextState);

  for (const event of auditEvents) {
    await store.appendAuditEvent(event);
  }

  return {
    state: nextState,
    audit_events: auditEvents,
    recovered_task_ids: recoveredTaskIds
  };
}

function createRecoveryAuditEvent(
  workflowId: string,
  now: string,
  payload: Record<string, unknown>
): AuditEvent {
  return {
    event_id: `evt_${Date.parse(now)}_${Math.random().toString(36).slice(2, 10)}`,
    workflow_id: workflowId,
    type: "WORKFLOW_RECOVERY",
    payload,
    created_at: now
  };
}
