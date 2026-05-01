import { assertAgentActionAllowed, type AgentActionPolicy } from "../agent_action/index.js";
import { TaskGraphSchedulerError } from "../errors.js";
import type { MessageType } from "../models/message.js";
import { validateTeamContext, type NodeRegistrySnapshot, type TeamContext } from "../node_registry/index.js";

export interface TeamDelegationValidationInput {
  snapshot: NodeRegistrySnapshot;
  actionPolicy: AgentActionPolicy;
  from: string;
  to: string;
  message_type: MessageType;
  team_context: TeamContext;
}

export function validateTeamDelegation(input: TeamDelegationValidationInput): void {
  validateTeamContext(input.snapshot, input.from, input.team_context);
  assertTargetIsTeamMember(input.snapshot, input.to, input.team_context.team_node_id);
  assertAgentActionAllowed(input.actionPolicy, {
    node_id: input.from,
    action: "delegate_to_member",
    message_type: input.message_type
  });
}

function assertTargetIsTeamMember(snapshot: NodeRegistrySnapshot, targetNodeId: string, teamNodeId: string): void {
  const team = snapshot.team_compositions.find((candidate) => candidate.team_node_id === teamNodeId);
  if (!team) {
    throw new TaskGraphSchedulerError("Delegation team must be registered.", "TEAM_DELEGATION_TEAM_NOT_REGISTERED", {
      team_node_id: teamNodeId
    });
  }

  if (!team.members.some((member) => member.node_id === targetNodeId)) {
    throw new TaskGraphSchedulerError("Delegation target must be a member of the same team.", "TEAM_DELEGATION_TARGET_NOT_MEMBER", {
      team_node_id: teamNodeId,
      target_node_id: targetNodeId
    });
  }
}
