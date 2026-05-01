import type { PlanProposal } from "../plan_proposal/index.js";
import type { WorkflowState } from "../models/workflow.js";

export interface WorkflowBootstrapInput {
  proposal_id: string;
  workflow_id?: string;
}

export interface WorkflowBootstrapResult {
  workflow_id: string;
  proposal: PlanProposal;
  state: WorkflowState;
  state_path: string;
  audit_path: string;
}

export function createWorkflowIdFromProposal(proposal: PlanProposal): string {
  return `wf_${proposal.intent_id}_${proposal.plan.plan_id}`.replace(/[^a-zA-Z0-9_-]+/g, "_");
}
