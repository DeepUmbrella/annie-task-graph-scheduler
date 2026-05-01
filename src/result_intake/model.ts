import type { WorkerTaskResult } from "../execution/result_collector.js";
import type { WorkflowState } from "../models/workflow.js";

export const resultIntakeDecisionStatuses = [
  "accepted",
  "rejected"
] as const;

export type ResultIntakeDecisionStatus = (typeof resultIntakeDecisionStatuses)[number];

export interface ResultIntakeInput {
  workflow_id: string;
  from: string;
  wave_id?: string;
  result: WorkerTaskResult;
}

export interface ResultIntakeDecision {
  status: ResultIntakeDecisionStatus;
  reason: string;
  workflow_id: string;
  task_id: string;
  wave_id: string | null;
  from: string;
  result_status: WorkerTaskResult["status"];
  next_task_status?: string;
}

export interface ResultIntakeResult {
  workflow_id: string;
  task_id: string;
  wave_id: string | null;
  from: string;
  decision: ResultIntakeDecision;
  submitted_result: WorkerTaskResult;
  state: WorkflowState;
  state_path: string;
  audit_path: string;
}
