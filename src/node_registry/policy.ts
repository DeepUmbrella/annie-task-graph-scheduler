import {
  createDelegateToMemberPermission,
  createSendMessagePermission,
  type AgentActionNodePolicy,
  type AgentActionPolicy
} from "../agent_action/index.js";
import type { NodeRegistrySnapshot, RegisteredNode } from "./model.js";

export function buildAgentActionPolicyFromNodeRegistry(snapshot: NodeRegistrySnapshot): AgentActionPolicy {
  return {
    policy_id: "node-registry-agent-action-policy",
    source: "configured",
    nodes: snapshot.nodes
      .filter((node) => node.status === "active")
      .map(toNodePolicy)
      .filter((node): node is AgentActionNodePolicy => node.permissions.length > 0)
  };
}

function toNodePolicy(node: RegisteredNode): AgentActionNodePolicy {
  return {
    node_id: node.node_id,
    runtime: node.runtime,
    permissions: node.granted_actions.map((action) => {
      if (action === "send_message") {
        return createSendMessagePermission();
      }
      if (action === "delegate_to_member") {
        return createDelegateToMemberPermission();
      }

      return null;
    }).filter((permission): permission is NonNullable<typeof permission> => permission !== null)
  };
}
