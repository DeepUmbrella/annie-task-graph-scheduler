import type { WaveReview } from "../models/wave.js";
import type { WorkflowState } from "../models/workflow.js";
import { TaskGraphSchedulerError } from "../errors.js";

export interface ReviewGateResult {
  state: WorkflowState;
  review: WaveReview;
}

export function reviewWave(
  state: WorkflowState,
  waveId: string,
  now = new Date().toISOString()
): ReviewGateResult {
  const wave = state.waves.find((candidate) => candidate.id === waveId);

  if (!wave) {
    throw new TaskGraphSchedulerError("Wave does not exist.", "WAVE_NOT_FOUND", {
      workflow_id: state.workflow_id,
      wave_id: waveId
    });
  }

  const tasks = wave.tasks.map((taskId) => state.tasks[taskId]).filter(Boolean);

  if (tasks.length !== wave.tasks.length) {
    throw new TaskGraphSchedulerError("Wave references missing tasks.", "WAVE_TASK_NOT_FOUND", {
      workflow_id: state.workflow_id,
      wave_id: waveId
    });
  }

  const incompleteTasks = tasks.filter((task) =>
    task.status === "assigned"
    || task.status === "running"
    || task.status === "ready"
    || task.status === "pending"
  );

  if (incompleteTasks.length > 0) {
    throw new TaskGraphSchedulerError("Wave still has incomplete tasks.", "WAVE_NOT_READY_FOR_REVIEW", {
      workflow_id: state.workflow_id,
      wave_id: waveId,
      task_ids: incompleteTasks.map((task) => task.id)
    });
  }

  const failedTasks = tasks.filter((task) => task.status === "failed");
  const conflicts = detectChangedFileConflicts(tasks);
  const allowNextWave = failedTasks.length === 0 && conflicts.length === 0;
  const review: WaveReview = {
    status: allowNextWave ? "passed" : "failed",
    completed_tasks: tasks.filter((task) => task.status === "reviewing" || task.status === "done").map((task) => task.id),
    failed_tasks: failedTasks.map((task) => task.id),
    conflicts,
    allow_next_wave: allowNextWave,
    summary: allowNextWave ? "Wave review passed." : "Wave review failed."
  };

  const nextTasks = { ...state.tasks };

  if (allowNextWave) {
    for (const task of tasks) {
      if (task.status === "reviewing") {
        nextTasks[task.id] = {
          ...task,
          status: "done",
          completed_at: task.completed_at ?? now
        };
      }
    }
  }

  const nextWave = {
    ...wave,
    status: allowNextWave ? "done" as const : "failed" as const,
    completed_at: now,
    review
  };

  return {
    state: {
      ...state,
      status: allowNextWave ? state.status : "blocked",
      current_wave: allowNextWave ? null : waveId,
      tasks: nextTasks,
      waves: state.waves.map((candidate) => candidate.id === waveId ? nextWave : candidate),
      updated_at: now
    },
    review
  };
}

function detectChangedFileConflicts(tasks: NonNullable<WorkflowState["tasks"][string]>[]): string[] {
  const fileOwners = new Map<string, string[]>();

  for (const task of tasks) {
    for (const file of task.changed_files) {
      const owners = fileOwners.get(file) ?? [];
      owners.push(task.id);
      fileOwners.set(file, owners);
    }
  }

  return [...fileOwners.entries()]
    .filter(([, owners]) => owners.length > 1)
    .map(([file, owners]) => `${file}: ${owners.join(", ")}`);
}
