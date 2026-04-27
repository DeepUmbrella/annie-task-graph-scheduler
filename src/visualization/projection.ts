import { taskStatuses, type TaskStatus } from "../models/task.js";
import { waveStatuses, type WaveStatus } from "../models/wave.js";
import type { WorkflowState } from "../models/workflow.js";
import type {
  CurrentWaveView,
  DependencyEdgeView,
  VisualizationModel,
  WaveView
} from "./model.js";

export function createVisualizationModel(
  state: WorkflowState,
  generatedAt = new Date().toISOString()
): VisualizationModel {
  return {
    workflow: {
      workflow_id: state.workflow_id,
      plan_id: state.plan_id,
      status: state.status,
      current_wave: state.current_wave,
      created_at: state.created_at,
      updated_at: state.updated_at
    },
    board: {
      totals: createWorkflowBoardTotals(state),
      current_wave: createCurrentWaveView(state),
      task_status_counts: countTaskStatuses(state),
      wave_status_counts: countWaveStatuses(state),
      agent_load: Object.values(state.agents).map((agent) => ({
        agent_id: agent.agent_id,
        status: agent.status,
        active_task_count: agent.active_task_ids.length,
        max_concurrent_tasks: agent.max_concurrent_tasks,
        capacity_remaining: Math.max(agent.max_concurrent_tasks - agent.active_task_ids.length, 0),
        active_task_ids: agent.active_task_ids,
        session_id: agent.session_id
      })),
      blocked_tasks: Object.values(state.tasks)
        .filter((task) => task.status === "blocked")
        .map((task) => ({
          task_id: task.id,
          title: task.title,
          blocked_reason: task.blocked_reason ?? null
        })),
      failed_tasks: Object.values(state.tasks)
        .filter((task) => task.status === "failed")
        .map((task) => ({
          task_id: task.id,
          title: task.title,
          failure_type: task.failure_type,
          failure_reason: task.failure_reason
        }))
    },
    dag: {
      nodes: Object.values(state.tasks).map((task) => ({
        id: task.id,
        title: task.title,
        status: task.status,
        risk: task.risk,
        assigned_to: task.assigned_to
      })),
      edges: createDependencyEdges(state)
    },
    waves: {
      current_wave: state.current_wave,
      waves: state.waves.map((wave): WaveView => ({
        id: wave.id,
        tasks: wave.tasks,
        status: wave.status,
        started_at: wave.started_at,
        completed_at: wave.completed_at
      }))
    },
    failures: {
      failed_tasks: Object.values(state.tasks)
        .filter((task) => task.status === "failed")
        .map((task) => ({
          task_id: task.id,
          title: task.title,
          failure_type: task.failure_type,
          failure_reason: task.failure_reason,
          retry_count: task.retry_count,
          next_recommendation: task.next_recommendation
        })),
      blocked_tasks: Object.values(state.tasks)
        .filter((task) => task.status === "blocked")
        .map((task) => ({
          task_id: task.id,
          title: task.title,
          blocked_reason: task.blocked_reason ?? null
        }))
    },
    generated_at: generatedAt
  };
}

function createWorkflowBoardTotals(state: WorkflowState) {
  const tasks = Object.values(state.tasks);
  const waves = state.waves;
  const completedTasks = tasks.filter((task) => task.status === "done").length;

  return {
    total_tasks: tasks.length,
    completed_tasks: completedTasks,
    failed_tasks: tasks.filter((task) => task.status === "failed").length,
    blocked_tasks: tasks.filter((task) => task.status === "blocked").length,
    total_waves: waves.length,
    completed_waves: waves.filter((wave) => wave.status === "done").length,
    completion_ratio: tasks.length === 0 ? 0 : completedTasks / tasks.length
  };
}

function createCurrentWaveView(state: WorkflowState): CurrentWaveView | null {
  if (!state.current_wave) {
    return null;
  }

  const wave = state.waves.find((candidate) => candidate.id === state.current_wave);

  if (!wave) {
    return null;
  }

  return {
    id: wave.id,
    status: wave.status,
    tasks: wave.tasks,
    completed_task_count: wave.tasks.filter((taskId) => state.tasks[taskId]?.status === "done").length,
    total_task_count: wave.tasks.length
  };
}

function countTaskStatuses(state: WorkflowState): Record<TaskStatus, number> {
  return Object.fromEntries(
    taskStatuses.map((status) => [
      status,
      Object.values(state.tasks).filter((task) => task.status === status).length
    ])
  ) as Record<TaskStatus, number>;
}

function countWaveStatuses(state: WorkflowState): Record<WaveStatus, number> {
  return Object.fromEntries(
    waveStatuses.map((status) => [
      status,
      state.waves.filter((wave) => wave.status === status).length
    ])
  ) as Record<WaveStatus, number>;
}

function createDependencyEdges(state: WorkflowState): DependencyEdgeView[] {
  return Object.values(state.tasks)
    .flatMap((task) => task.depends_on.map((dependencyId): DependencyEdgeView => ({
      id: `${dependencyId}->${task.id}`,
      source: dependencyId,
      target: task.id,
      status: getDependencyEdgeStatus(state, dependencyId)
    })))
    .sort((left, right) => left.id.localeCompare(right.id));
}

function getDependencyEdgeStatus(
  state: WorkflowState,
  dependencyId: string
): DependencyEdgeView["status"] {
  const dependency = state.tasks[dependencyId];

  if (!dependency) {
    return "waiting";
  }

  if (dependency.status === "failed" || dependency.status === "blocked") {
    return "blocked";
  }

  return dependency.status === "done" ? "satisfied" : "waiting";
}
