import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { AuditEvent } from "../models/audit.js";
import type { TaskStatus } from "../models/task.js";
import type { WorkflowState } from "../models/workflow.js";
import { TaskGraphSchedulerError } from "../errors.js";

export interface StateStore {
  workflowDir(workflowId: string): string;
  statePath(workflowId: string): string;
  auditPath(workflowId: string): string;
  saveState(state: WorkflowState): Promise<void>;
  loadState(workflowId: string): Promise<WorkflowState>;
  appendAuditEvent(event: AuditEvent): Promise<void>;
  transitionTaskStatus(
    state: WorkflowState,
    taskId: string,
    to: TaskStatus,
    options?: TransitionOptions
  ): Promise<WorkflowState>;
}

export interface TransitionOptions {
  now?: string;
  reason?: string;
  allowManualOverride?: boolean;
}

const allowedTaskTransitions: Record<TaskStatus, TaskStatus[]> = {
  pending: ["ready", "blocked", "cancelled"],
  ready: ["assigned", "running", "blocked", "cancelled"],
  assigned: ["running", "ready", "blocked", "cancelled"],
  running: ["reviewing", "failed", "cancelled"],
  reviewing: ["done", "failed"],
  done: [],
  failed: ["ready", "blocked"],
  blocked: ["ready", "cancelled"],
  cancelled: []
};

export function createStateStore(rootDir = ".annie"): StateStore {
  return new FileStateStore(rootDir);
}

class FileStateStore implements StateStore {
  constructor(private readonly rootDir: string) {}

  workflowDir(workflowId: string): string {
    return join(this.rootDir, "workflows", workflowId);
  }

  statePath(workflowId: string): string {
    return join(this.workflowDir(workflowId), "state.json");
  }

  auditPath(workflowId: string): string {
    return join(this.workflowDir(workflowId), "audit.jsonl");
  }

  async saveState(state: WorkflowState): Promise<void> {
    const workflowDir = this.workflowDir(state.workflow_id);
    await mkdir(workflowDir, { recursive: true });

    const statePath = this.statePath(state.workflow_id);
    const tempPath = `${statePath}.tmp`;
    await writeFile(tempPath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
    await rename(tempPath, statePath);
  }

  async loadState(workflowId: string): Promise<WorkflowState> {
    const statePath = this.statePath(workflowId);

    try {
      const raw = await readFile(statePath, "utf8");
      return JSON.parse(raw) as WorkflowState;
    } catch (error) {
      throw new TaskGraphSchedulerError("Failed to load workflow state.", "STATE_LOAD_FAILED", {
        workflow_id: workflowId,
        path: statePath,
        cause: error instanceof Error ? error.message : String(error)
      });
    }
  }

  async appendAuditEvent(event: AuditEvent): Promise<void> {
    const workflowDir = this.workflowDir(event.workflow_id);
    await mkdir(workflowDir, { recursive: true });

    await writeFile(this.auditPath(event.workflow_id), `${JSON.stringify(event)}\n`, {
      encoding: "utf8",
      flag: "a"
    });
  }

  async transitionTaskStatus(
    state: WorkflowState,
    taskId: string,
    to: TaskStatus,
    options: TransitionOptions = {}
  ): Promise<WorkflowState> {
    const task = state.tasks[taskId];

    if (!task) {
      throw new TaskGraphSchedulerError("Task does not exist.", "TASK_NOT_FOUND", {
        workflow_id: state.workflow_id,
        task_id: taskId
      });
    }

    const from = task.status;

    if (!isTaskTransitionAllowed(from, to, options.allowManualOverride ?? false)) {
      throw new TaskGraphSchedulerError("Task status transition is not allowed.", "TASK_STATUS_TRANSITION_INVALID", {
        workflow_id: state.workflow_id,
        task_id: taskId,
        from,
        to
      });
    }

    const now = options.now ?? new Date().toISOString();
    const nextState: WorkflowState = {
      ...state,
      tasks: {
        ...state.tasks,
        [taskId]: {
          ...task,
          status: to,
          started_at: to === "running" ? now : task.started_at,
          completed_at: to === "done" || to === "failed" || to === "cancelled" ? now : task.completed_at
        }
      },
      updated_at: now
    };

    await this.saveState(nextState);
    await this.appendAuditEvent({
      event_id: createAuditEventId(now),
      workflow_id: state.workflow_id,
      type: "TASK_STATUS_CHANGED",
      payload: {
        task_id: taskId,
        from,
        to,
        reason: options.reason ?? null
      },
      created_at: now
    });

    return nextState;
  }
}

export function isTaskTransitionAllowed(
  from: TaskStatus,
  to: TaskStatus,
  allowManualOverride = false
): boolean {
  if (from === to) {
    return true;
  }

  if (allowManualOverride && from === "failed" && to === "done") {
    return true;
  }

  return allowedTaskTransitions[from].includes(to);
}

function createAuditEventId(now: string): string {
  const suffix = Math.random().toString(36).slice(2, 10);
  return `evt_${Date.parse(now)}_${suffix}`;
}
