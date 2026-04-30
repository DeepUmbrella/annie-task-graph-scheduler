import { TaskGraphSchedulerError } from "../errors.js";
import type { MessageType } from "../models/message.js";

export const agentActionTypes = [
  "send_message"
] as const;

export type AgentActionType = (typeof agentActionTypes)[number];

export interface AgentActionPermission {
  action: AgentActionType;
  message_types: MessageType[];
}

export interface AgentActionNodePolicy {
  node_id: string;
  runtime?: string;
  permissions: AgentActionPermission[];
}

export interface AgentActionPolicy {
  policy_id: string;
  source: "local_default" | "configured";
  nodes: AgentActionNodePolicy[];
}

export interface AgentActionCheck {
  node_id: string;
  action: AgentActionType;
  message_type: MessageType;
}

export function createDefaultAgentActionPolicy(): AgentActionPolicy {
  return {
    policy_id: "default-agent-action-policy",
    source: "local_default",
    nodes: [
      createSendMessageNodePolicy("develop-team", "openclaw"),
      createSendMessageNodePolicy("annie-dev", "openclaw"),
      createSendMessageNodePolicy("annie-pm", "openclaw"),
      createSendMessageNodePolicy("team-lead-agent"),
      createSendMessageNodePolicy("review-agent"),
      createSendMessageNodePolicy("local-review-node", "local")
    ]
  };
}

export function assertAgentActionAllowed(policy: AgentActionPolicy, check: AgentActionCheck): void {
  const node = policy.nodes.find((candidate) => candidate.node_id === check.node_id);
  if (!node) {
    throw new TaskGraphSchedulerError("Agent action node is not configured.", "AGENT_ACTION_NODE_NOT_FOUND", {
      node_id: check.node_id,
      policy_id: policy.policy_id
    });
  }

  const permission = node.permissions.find((candidate) => candidate.action === check.action);
  if (!permission) {
    throw new TaskGraphSchedulerError("Agent action is not allowed for node.", "AGENT_ACTION_NOT_ALLOWED", {
      node_id: check.node_id,
      action: check.action
    });
  }

  if (!permission.message_types.includes(check.message_type)) {
    throw new TaskGraphSchedulerError("Message type is not allowed for agent action.", "AGENT_ACTION_MESSAGE_TYPE_NOT_ALLOWED", {
      node_id: check.node_id,
      action: check.action,
      message_type: check.message_type
    });
  }
}

export function isAgentActionType(value: string): value is AgentActionType {
  return agentActionTypes.includes(value as AgentActionType);
}

function createSendMessageNodePolicy(nodeId: string, runtime?: string): AgentActionNodePolicy {
  return {
    node_id: nodeId,
    runtime,
    permissions: [
      {
        action: "send_message",
        message_types: [
          "REQUIREMENT_CLARIFICATION_REQUEST",
          "QUESTION_ASKED",
          "ANSWER_PROVIDED",
          "HELP_REQUESTED",
          "BLOCKER_REPORTED"
        ]
      }
    ]
  };
}
