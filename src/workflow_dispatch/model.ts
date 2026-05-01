import type { Message } from "../models/message.js";
import type { WorkflowState } from "../models/workflow.js";

export const workflowDispatchDecisionStatuses = [
  "dispatched",
  "partially_dispatched",
  "already_dispatched",
  "no_active_wave",
  "no_dispatchable_tasks",
  "failed"
] as const;

export type WorkflowDispatchDecisionStatus = (typeof workflowDispatchDecisionStatuses)[number];

export interface WorkflowDispatchInput {
  workflow_id: string;
  wave_id?: string;
}

export interface WorkflowDispatchAssignment {
  task_id: string;
  node_id: string;
  message_id: string;
  inbox_path: string;
  decision: string;
}

export interface WorkflowDispatchRejection {
  task_id: string;
  reason: string;
  code: string;
}

export interface WorkflowDispatchSelection {
  task_id: string;
  node_id: string;
  decision: string;
}

export interface WorkflowDispatchSelectionResult {
  workflow_id: string;
  wave_id: string | null;
  selections: WorkflowDispatchSelection[];
  rejections: WorkflowDispatchRejection[];
}

export interface WorkflowDispatchDecision {
  status: WorkflowDispatchDecisionStatus;
  reason: string;
  workflow_id: string;
  wave_id: string | null;
  dispatched_task_ids: string[];
  rejected_task_ids: string[];
  already_dispatched_task_ids: string[];
}

export interface WorkflowDispatchResult {
  workflow_id: string;
  wave_id: string | null;
  decision: WorkflowDispatchDecision;
  assignments: WorkflowDispatchAssignment[];
  rejections: WorkflowDispatchRejection[];
  messages: Message[];
  state: WorkflowState;
  state_path: string;
  audit_path: string;
}
