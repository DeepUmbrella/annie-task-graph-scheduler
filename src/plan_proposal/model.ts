import type { TaskDagPlan } from "../models/plan.js";

export interface PlanProposal {
  proposal_id: string;
  intent_id: string;
  from: string;
  runtime?: string | null;
  received_at: string;
  plan: TaskDagPlan;
  validation_status: "valid";
}

export interface PlanProposalIntakePayload {
  intent_id: string;
  from: string;
  runtime?: string | null;
  plan: TaskDagPlan;
  raw_payload: unknown;
}
