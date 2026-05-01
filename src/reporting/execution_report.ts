import type { TaskStatus } from "../models/task.js";
import type { WaveStatus } from "../models/wave.js";
import type { WorkflowState } from "../models/workflow.js";

export interface WorkflowExecutionReport {
  workflow_id: string;
  plan_id: string;
  status: WorkflowState["status"];
  current_wave: string | null;
  generated_at: string;
  task_summary: {
    total: number;
    by_status: Record<TaskStatus, number>;
    completed: number;
    failed: number;
    blocked: number;
    reviewing: number;
    running: number;
    pending_or_ready: number;
  };
  wave_summary: {
    total: number;
    by_status: Record<WaveStatus, number>;
    reviews: Array<{
      wave_id: string;
      status: "passed" | "failed" | null;
      allow_next_wave: boolean | null;
      completed_tasks: string[];
      failed_tasks: string[];
      conflicts: string[];
    }>;
  };
  tasks: Array<{
    id: string;
    title: string;
    status: TaskStatus;
    depends_on: string[];
    assigned_to: string | null;
    risk: string;
    changed_files_count: number;
    tests_run_count: number;
    risks_found_count: number;
    result_summary: string | null;
    failure_type: string | null;
    failure_reason: string | null;
    blocked_reason: string | null;
    next_recommendation: string | null;
  }>;
  failures: Array<{
    task_id: string;
    title: string;
    status: TaskStatus;
    failure_type: string | null;
    failure_reason: string | null;
    blocked_reason: string | null;
  }>;
  handoff: {
    source: "TaskGraphScheduler";
    target: "ExecutionWorkflow" | "Delivery";
    audit_required: boolean;
    state_updated_at: string;
  };
}

const taskStatuses: TaskStatus[] = ["pending", "ready", "assigned", "running", "reviewing", "done", "failed", "blocked", "cancelled"];
const waveStatuses: WaveStatus[] = ["pending", "running", "reviewing", "done", "failed", "blocked"];

export function createWorkflowExecutionReport(
  state: WorkflowState,
  options: { generated_at?: string } = {}
): WorkflowExecutionReport {
  const tasks = Object.values(state.tasks).sort((a, b) => a.id.localeCompare(b.id));
  const taskStatusCounts = countBy(taskStatuses, tasks.map((task) => task.status));
  const waveStatusCounts = countBy(waveStatuses, state.waves.map((wave) => wave.status));

  return {
    workflow_id: state.workflow_id,
    plan_id: state.plan_id,
    status: state.status,
    current_wave: state.current_wave,
    generated_at: options.generated_at ?? new Date().toISOString(),
    task_summary: {
      total: tasks.length,
      by_status: taskStatusCounts,
      completed: taskStatusCounts.done,
      failed: taskStatusCounts.failed,
      blocked: taskStatusCounts.blocked,
      reviewing: taskStatusCounts.reviewing,
      running: taskStatusCounts.running,
      pending_or_ready: taskStatusCounts.pending + taskStatusCounts.ready
    },
    wave_summary: {
      total: state.waves.length,
      by_status: waveStatusCounts,
      reviews: state.waves.map((wave) => ({
        wave_id: wave.id,
        status: wave.review?.status ?? null,
        allow_next_wave: wave.review?.allow_next_wave ?? null,
        completed_tasks: wave.review?.completed_tasks ?? [],
        failed_tasks: wave.review?.failed_tasks ?? [],
        conflicts: wave.review?.conflicts ?? []
      }))
    },
    tasks: tasks.map((task) => ({
      id: task.id,
      title: task.title,
      status: task.status,
      depends_on: task.depends_on,
      assigned_to: task.assigned_to,
      risk: task.risk,
      changed_files_count: task.changed_files.length,
      tests_run_count: task.tests_run.length,
      risks_found_count: task.risks_found.length,
      result_summary: task.result_summary,
      failure_type: task.failure_type,
      failure_reason: task.failure_reason,
      blocked_reason: task.blocked_reason ?? null,
      next_recommendation: task.next_recommendation
    })),
    failures: tasks
      .filter((task) => task.status === "failed" || task.status === "blocked")
      .map((task) => ({
        task_id: task.id,
        title: task.title,
        status: task.status,
        failure_type: task.failure_type,
        failure_reason: task.failure_reason,
        blocked_reason: task.blocked_reason ?? null
      })),
    handoff: {
      source: "TaskGraphScheduler",
      target: state.status === "done" ? "Delivery" : "ExecutionWorkflow",
      audit_required: true,
      state_updated_at: state.updated_at
    }
  };
}

function countBy<T extends string>(keys: T[], values: T[]): Record<T, number> {
  const counts = Object.fromEntries(keys.map((key) => [key, 0])) as Record<T, number>;
  for (const value of values) {
    counts[value] += 1;
  }
  return counts;
}
