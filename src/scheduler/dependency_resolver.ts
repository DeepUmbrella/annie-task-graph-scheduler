import type { Task, TaskStatus } from "../models/task.js";
import type { WorkflowState } from "../models/workflow.js";

export interface DependencyResolution {
  state: WorkflowState;
  ready_task_ids: string[];
  blocked_task_ids: string[];
  status_changes: TaskStatusChange[];
}

export interface TaskStatusChange {
  task_id: string;
  from: TaskStatus;
  to: TaskStatus;
  reason: string;
}

export function resolveDependencies(state: WorkflowState): DependencyResolution {
  const nextState: WorkflowState = {
    ...state,
    tasks: Object.fromEntries(
      Object.entries(state.tasks).map(([taskId, task]) => [taskId, { ...task }])
    ),
    updated_at: new Date().toISOString()
  };
  const statusChanges: TaskStatusChange[] = [];

  for (const task of Object.values(nextState.tasks)) {
    if (task.status !== "pending" && task.status !== "ready" && task.status !== "blocked") {
      continue;
    }

    const upstreamTasks = task.depends_on.map((dependencyId) => nextState.tasks[dependencyId]).filter(Boolean);
    const failedDependency = upstreamTasks.find((upstreamTask) =>
      upstreamTask.status === "failed" || upstreamTask.status === "blocked"
    );

    if (failedDependency) {
      setTaskStatus(nextState.tasks[task.id], "blocked", statusChanges, {
        reason: `Dependency ${failedDependency.id} is ${failedDependency.status}.`,
        blockedReason: `Blocked by dependency ${failedDependency.id}.`
      });
      continue;
    }

    const dependenciesDone = upstreamTasks.length === task.depends_on.length
      && upstreamTasks.every((upstreamTask) => upstreamTask.status === "done");

    if (dependenciesDone && task.status === "pending") {
      setTaskStatus(nextState.tasks[task.id], "ready", statusChanges, {
        reason: "All dependencies are done."
      });
    }
  }

  return {
    state: nextState,
    ready_task_ids: Object.values(nextState.tasks)
      .filter((task) => task.status === "ready")
      .map((task) => task.id),
    blocked_task_ids: Object.values(nextState.tasks)
      .filter((task) => task.status === "blocked")
      .map((task) => task.id),
    status_changes: statusChanges
  };
}

function setTaskStatus(
  task: Task | undefined,
  to: TaskStatus,
  changes: TaskStatusChange[],
  options: { reason: string; blockedReason?: string }
): void {
  if (!task || task.status === to) {
    return;
  }

  const from = task.status;
  task.status = to;

  if (options.blockedReason) {
    task.blocked_reason = options.blockedReason;
  }

  changes.push({
    task_id: task.id,
    from,
    to,
    reason: options.reason
  });
}
