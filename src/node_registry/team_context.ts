import { TaskGraphSchedulerError } from "../errors.js";
import type { NodeRegistrySnapshot, TeamContext } from "./model.js";

export function validateTeamContext(
  snapshot: NodeRegistrySnapshot,
  nodeId: string,
  context: TeamContext
): void {
  const node = snapshot.nodes.find((candidate) => candidate.node_id === nodeId);
  if (!node) {
    throw new TaskGraphSchedulerError("Team context node must be registered.", "TEAM_CONTEXT_NODE_NOT_REGISTERED", {
      node_id: nodeId,
      team_node_id: context.team_node_id
    });
  }

  const team = snapshot.team_compositions.find((candidate) => candidate.team_node_id === context.team_node_id);
  if (!team) {
    throw new TaskGraphSchedulerError("Team context team must be registered.", "TEAM_CONTEXT_TEAM_NOT_REGISTERED", {
      node_id: nodeId,
      team_node_id: context.team_node_id
    });
  }

  const member = team.members.find((candidate) => candidate.node_id === nodeId);
  if (!member) {
    throw new TaskGraphSchedulerError("Node is not a member of the requested team context.", "TEAM_CONTEXT_NODE_NOT_MEMBER", {
      node_id: nodeId,
      team_node_id: context.team_node_id
    });
  }

  if (context.role && member.team_role !== context.role) {
    throw new TaskGraphSchedulerError("Node team context role does not match team composition.", "TEAM_CONTEXT_ROLE_MISMATCH", {
      node_id: nodeId,
      team_node_id: context.team_node_id,
      expected_role: member.team_role,
      claimed_role: context.role
    });
  }
}
