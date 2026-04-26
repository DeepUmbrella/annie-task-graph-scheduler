import type { Task } from "../models/task.js";
import type { Wave } from "../models/wave.js";
import type { WorkflowState } from "../models/workflow.js";
import { hasFileConflict } from "./conflict_detector.js";

export interface NextWaveResult {
  wave: Wave | null;
  ready_task_ids: string[];
  skipped_ready_tasks: Array<{ task_id: string; reason: string }>;
}

export function generateNextWave(state: WorkflowState): NextWaveResult {
  const readyTasks = Object.values(state.tasks).filter((task) => task.status === "ready");
  const selectedTasks: Task[] = [];
  const skippedReadyTasks: Array<{ task_id: string; reason: string }> = [];
  const agentKeys = new Set<string>();

  for (const task of readyTasks) {
    const skipReason = getSkipReason(task, selectedTasks, agentKeys, state);

    if (skipReason) {
      skippedReadyTasks.push({
        task_id: task.id,
        reason: skipReason
      });
      continue;
    }

    selectedTasks.push(task);
    agentKeys.add(getAgentKey(task));
  }

  if (selectedTasks.length === 0) {
    return {
      wave: null,
      ready_task_ids: readyTasks.map((task) => task.id),
      skipped_ready_tasks: skippedReadyTasks
    };
  }

  const wave: Wave = {
    id: createNextWaveId(state),
    tasks: selectedTasks.map((task) => task.id),
    status: "pending",
    started_at: null,
    completed_at: null,
    review: null,
    reason: "Ready tasks selected under dependency, concurrency, agent, risk, and file-conflict constraints.",
    skipped_ready_tasks: skippedReadyTasks
  };

  return {
    wave,
    ready_task_ids: readyTasks.map((task) => task.id),
    skipped_ready_tasks: skippedReadyTasks
  };
}

function getSkipReason(
  task: Task,
  selectedTasks: Task[],
  agentKeys: Set<string>,
  state: WorkflowState
): string | null {
  if (selectedTasks.length >= state.execution_policy.max_parallel_tasks) {
    return `Skipped because max_parallel_tasks=${state.execution_policy.max_parallel_tasks} has been reached.`;
  }

  if (selectedTasks.length > 0 && !task.can_parallel) {
    return "Skipped because task is marked can_parallel=false.";
  }

  if (selectedTasks.some((selectedTask) => !selectedTask.can_parallel)) {
    return "Skipped because current wave already contains a non-parallel task.";
  }

  const nextAgentKey = getAgentKey(task);
  if (!agentKeys.has(nextAgentKey) && agentKeys.size >= state.execution_policy.max_agents) {
    return `Skipped because max_agents=${state.execution_policy.max_agents} has been reached.`;
  }

  if (hasFileConflict(task, selectedTasks)) {
    return "Skipped because expected_files conflicts with a task already selected for this wave.";
  }

  if (task.risk === "high" || task.risk === "critical") {
    const hasHighRiskTask = selectedTasks.some((selectedTask) =>
      selectedTask.risk === "high" || selectedTask.risk === "critical"
    );

    if (hasHighRiskTask) {
      return "Skipped because high-risk tasks are serialized in Phase 1.";
    }
  }

  return null;
}

function getAgentKey(task: Task): string {
  return task.preferred_agent ?? "__default_agent__";
}

function createNextWaveId(state: WorkflowState): string {
  return `wave_${String(state.waves.length + 1).padStart(3, "0")}`;
}
