import type { AgentActionType } from "../agent_action/index.js";
import type { NodeRegistrationProposal } from "../node_registry/index.js";

export interface NodeRegistrationApprovalPolicy {
  default_granted_actions?: AgentActionType[];
  node_grants?: Record<string, AgentActionType[]>;
}

export function createDenyAllRegistrationApprovalPolicy(): NodeRegistrationApprovalPolicy {
  return {
    default_granted_actions: [],
    node_grants: {}
  };
}

export function approveNodeRegistrationProposal(
  proposal: NodeRegistrationProposal,
  policy: NodeRegistrationApprovalPolicy = createDenyAllRegistrationApprovalPolicy()
): NodeRegistrationProposal {
  return {
    ...proposal,
    nodes: proposal.nodes.map((node) => {
      const allowed = new Set(policy.node_grants?.[node.node_id] ?? policy.default_granted_actions ?? []);
      const granted = (node.requested_actions ?? []).filter((action) => allowed.has(action));

      return {
        ...node,
        granted_actions: granted
      };
    })
  };
}
