import { taskStatuses, type TaskStatus } from "../models/task.js";
import { waveStatuses, type WaveStatus } from "../models/wave.js";
import type { WorkflowState } from "../models/workflow.js";
import type {
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
      task_status_counts: countTaskStatuses(state),
      wave_status_counts: countWaveStatuses(state),
      agent_load: Object.values(state.agents).map((agent) => ({
        agent_id: agent.agent_id,
        status: agent.status,
        active_task_count: agent.active_task_ids.length,
        max_concurrent_tasks: agent.max_concurrent_tasks,
        session_id: agent.session_id
      })),
      blocked_tasks: Object.values(state.tasks).filter((task) => task.status === "blocked").map((task) => task.id),
      failed_tasks: Object.values(state.tasks).filter((task) => task.status === "failed").map((task) => task.id)
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

