import { TaskGraphSchedulerError } from "../errors.js";
import type { AuditEvent } from "../models/audit.js";
import { createPlanProposalStore, type PlanProposalStore } from "../plan_proposal/index.js";
import { createStateStore, type StateStore } from "../storage/state_store.js";
import { createInitialWorkflowState, loadPlan } from "../validation/plan_loader.js";
import { createWorkflowIdFromProposal, type WorkflowBootstrapInput, type WorkflowBootstrapResult } from "./model.js";

export interface WorkflowBootstrapOptions {
  rootDir?: string;
  proposalStore?: PlanProposalStore;
  stateStore?: StateStore;
  now?: string;
}

export async function bootstrapWorkflowFromProposal(
  input: WorkflowBootstrapInput,
  options: WorkflowBootstrapOptions = {}
): Promise<WorkflowBootstrapResult> {
  const proposalStore = options.proposalStore ?? createPlanProposalStore(options.rootDir);
  const stateStore = options.stateStore ?? createStateStore(options.rootDir);
  const snapshot = await proposalStore.loadSnapshot();
  const proposal = snapshot.proposals.find((candidate) => candidate.proposal_id === input.proposal_id);

  if (!proposal) {
    throw new TaskGraphSchedulerError("Plan proposal does not exist.", "PLAN_PROPOSAL_NOT_FOUND", {
      proposal_id: input.proposal_id
    });
  }

  const now = options.now ?? new Date().toISOString();
  const workflowId = input.workflow_id ?? createWorkflowIdFromProposal(proposal);
  const state = createInitialWorkflowState(workflowId, loadPlan(proposal.plan), now);

  await stateStore.saveState(state);
  await stateStore.appendAuditEvent(createBootstrapAuditEvent(workflowId, input.proposal_id, now));

  return {
    workflow_id: workflowId,
    proposal,
    state,
    state_path: stateStore.statePath(workflowId),
    audit_path: stateStore.auditPath(workflowId)
  };
}

function createBootstrapAuditEvent(workflowId: string, proposalId: string, now: string): AuditEvent {
  return {
    event_id: `evt_${Date.parse(now)}_workflow_bootstrap`,
    workflow_id: workflowId,
    type: "WORKFLOW_BOOTSTRAPPED",
    payload: {
      proposal_id: proposalId
    },
    created_at: now
  };
}
