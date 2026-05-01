import type { NextWaveResult } from "../scheduler/scheduler.js";
import type { WorkflowState } from "../models/workflow.js";

export const workflowSchedulingDecisionStatuses = [
  "scheduled",
  "active_wave",
  "no_ready_tasks",
  "completed",
  "failed"
] as const;

export type WorkflowSchedulingDecisionStatus = (typeof workflowSchedulingDecisionStatuses)[number];

export interface WorkflowSchedulingInput {
  workflow_id: string;
}

export interface WorkflowSchedulingDecision {
  status: WorkflowSchedulingDecisionStatus;
  reason: string;
  workflow_id: string;
  wave_id?: string;
  ready_task_ids: string[];
  blocked_task_ids: string[];
  pending_task_ids: string[];
  completed_task_ids: string[];
  failed_task_ids: string[];
}

export interface WorkflowSchedulingResult {
  workflow_id: string;
  decision: WorkflowSchedulingDecision;
  state: WorkflowState;
  next_wave: NextWaveResult | null;
  state_path: string;
  audit_path: string;
}
