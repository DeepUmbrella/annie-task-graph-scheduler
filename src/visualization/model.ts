import type { TaskStatus } from "../models/task.js";
import type { WaveStatus } from "../models/wave.js";
import type { AgentRuntimeState, WorkflowState } from "../models/workflow.js";

export interface VisualizationModel {
  workflow: WorkflowVisualizationSummary;
  board: WorkflowBoardView;
  dag: DagGraphView;
  waves: WaveProgressView;
  failures: FailureTrackingView;
  generated_at: string;
}

export interface WorkflowVisualizationSummary {
  workflow_id: string;
  plan_id: string;
  status: WorkflowState["status"];
  current_wave: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkflowBoardView {
  totals: WorkflowBoardTotals;
  current_wave: CurrentWaveView | null;
  task_status_counts: Record<TaskStatus, number>;
  wave_status_counts: Record<WaveStatus, number>;
  agent_load: AgentLoadView[];
  blocked_tasks: BlockedTaskSummaryView[];
  failed_tasks: FailedTaskSummaryView[];
}

export interface WorkflowBoardTotals {
  total_tasks: number;
  completed_tasks: number;
  failed_tasks: number;
  blocked_tasks: number;
  total_waves: number;
  completed_waves: number;
  completion_ratio: number;
}

export interface CurrentWaveView {
  id: string;
  status: WaveStatus;
  tasks: string[];
  completed_task_count: number;
  total_task_count: number;
}

export interface AgentLoadView {
  agent_id: string;
  status: AgentRuntimeState["status"];
  active_task_count: number;
  max_concurrent_tasks: number;
  capacity_remaining: number;
  active_task_ids: string[];
  session_id: string | null;
}

export interface BlockedTaskSummaryView {
  task_id: string;
  title: string;
  blocked_reason: string | null;
}

export interface FailedTaskSummaryView {
  task_id: string;
  title: string;
  failure_type: string | null;
  failure_reason: string | null;
}

export interface DagGraphView {
  nodes: TaskNodeView[];
  edges: DependencyEdgeView[];
}

export interface TaskNodeView {
  id: string;
  title: string;
  status: TaskStatus;
  risk: string;
  assigned_to: string | null;
}

export interface DependencyEdgeView {
  id: string;
  source: string;
  target: string;
  status: "satisfied" | "waiting" | "blocked";
}

export interface WaveProgressView {
  current_wave: string | null;
  waves: WaveView[];
}

export interface WaveView {
  id: string;
  tasks: string[];
  status: WaveStatus;
  started_at: string | null;
  completed_at: string | null;
}

export interface FailureTrackingView {
  failed_tasks: FailureTaskView[];
  blocked_tasks: BlockedTaskView[];
}

export interface FailureTaskView {
  task_id: string;
  title: string;
  failure_type: string | null;
  failure_reason: string | null;
  retry_count: number;
  next_recommendation: string | null;
}

export interface BlockedTaskView {
  task_id: string;
  title: string;
  blocked_reason: string | null;
}
