import { createMailboxStore, type MailboxStore } from "../communication/mailbox_store.js";
import { createMessageBus } from "../communication/message_bus.js";
import {
  assertAgentActionAllowed,
  createDefaultAgentActionPolicy,
  isAgentActionType,
  type AgentActionPolicy,
  type AgentActionType
} from "../agent_action/index.js";
import { messageTypes, type Message, type MessageType } from "../models/message.js";
import { TaskGraphSchedulerError } from "../errors.js";
import type { NodeRegistrySnapshot, TeamContext } from "../node_registry/index.js";
import { validateTeamDelegation } from "../team_delegation/index.js";

export interface AgentMessagePayload {
  intent_id: string;
  from: string;
  runtime: string | null;
  action: AgentActionType;
  to: string;
  message_type: MessageType;
  team_context: TeamContext | null;
  text: string;
  raw_payload: unknown;
}

export interface AgentMessageIntakeOptions {
  rootDir?: string;
  mailboxStore?: MailboxStore;
  actionPolicy?: AgentActionPolicy;
  nodeRegistrySnapshot?: NodeRegistrySnapshot;
  now?: string;
}

export interface AgentMessageIntakeResult {
  message: Message;
  inbox_path: string;
  questions: string[];
  classification: "requirement_clarification_request" | "team_delegation";
}

export async function intakeAgentMessage(
  payload: unknown,
  options: AgentMessageIntakeOptions = {}
): Promise<AgentMessageIntakeResult> {
  const agentMessage = parseAgentMessagePayload(payload);
  const rootDir = options.rootDir ?? ".annie";
  const mailboxStore = options.mailboxStore ?? createMailboxStore(rootDir);
  const actionPolicy = options.actionPolicy ?? createDefaultAgentActionPolicy();
  const bus = createMessageBus({
    mailbox_store: mailboxStore
  });
  const questions = extractClarificationQuestions(agentMessage.text);
  const classification = classifyAgentMessage(agentMessage);
  if (agentMessage.action === "delegate_to_member") {
    if (!options.nodeRegistrySnapshot) {
      throw new TaskGraphSchedulerError("Delegation requires a node registry snapshot.", "AGENT_MESSAGE_NODE_REGISTRY_REQUIRED");
    }
    if (!agentMessage.team_context) {
      throw new TaskGraphSchedulerError("Delegation requires team_context.", "AGENT_MESSAGE_TEAM_CONTEXT_REQUIRED");
    }
    validateTeamDelegation({
      snapshot: options.nodeRegistrySnapshot,
      actionPolicy,
      from: agentMessage.from,
      to: agentMessage.to,
      message_type: agentMessage.message_type,
      team_context: agentMessage.team_context
    });
  } else {
    assertAgentActionAllowed(actionPolicy, {
      node_id: agentMessage.from,
      action: agentMessage.action,
      message_type: agentMessage.message_type
    });
  }
  const message = bus.createMessage({
    workflow_id: agentMessage.intent_id,
    task_id: "planning",
    wave_id: "planning",
    from: agentMessage.from,
    to: agentMessage.to,
    type: agentMessage.message_type,
    priority: "high",
    payload: {
      intent_id: agentMessage.intent_id,
      action: agentMessage.action,
      questions,
      reply_text: agentMessage.text,
      raw_payload: agentMessage.raw_payload,
      runtime: agentMessage.runtime,
      team_context: agentMessage.team_context,
      classification
    },
    created_at: options.now
  });
  const delivered = await bus.sendMessage(message);

  return {
    message: delivered,
    inbox_path: mailboxStore.mailboxPath(agentMessage.intent_id, agentMessage.to, "inbox"),
    questions,
    classification
  };
}

export function parseAgentMessagePayload(payload: unknown): AgentMessagePayload {
  if (!isRecord(payload)) {
    throw new TaskGraphSchedulerError("Agent message payload must be an object.", "AGENT_MESSAGE_PAYLOAD_INVALID");
  }

  const intentId = firstString(payload, ["intent_id", "workflow_id"]);
  const from = firstString(payload, ["from", "agent_id", "planner_agent_id"]);
  const runtime = firstString(payload, ["runtime", "runtime_id"]);
  const action = firstString(payload, ["action"]);
  const to = firstString(payload, ["to", "target", "recipient"]);
  const messageType = firstString(payload, ["message_type", "type"]);
  const text = firstString(payload, ["message", "text", "reply", "content"]);
  const teamContext = parseTeamContext(payload.team_context);

  if (!intentId) {
    throw new TaskGraphSchedulerError("Agent message payload requires intent_id.", "AGENT_MESSAGE_INTENT_REQUIRED");
  }
  if (!from) {
    throw new TaskGraphSchedulerError("Agent message payload requires from.", "AGENT_MESSAGE_FROM_REQUIRED");
  }
  if (!action) {
    throw new TaskGraphSchedulerError("Agent message payload requires action.", "AGENT_MESSAGE_ACTION_REQUIRED");
  }
  if (!isAgentActionType(action)) {
    throw new TaskGraphSchedulerError("Agent message action is not supported.", "AGENT_MESSAGE_ACTION_INVALID", {
      action
    });
  }
  if (!to) {
    throw new TaskGraphSchedulerError("Agent message payload requires to.", "AGENT_MESSAGE_TO_REQUIRED");
  }
  if (!messageType) {
    throw new TaskGraphSchedulerError("Agent message payload requires message_type.", "AGENT_MESSAGE_TYPE_REQUIRED");
  }
  if (!isMessageType(messageType)) {
    throw new TaskGraphSchedulerError("Agent message_type is not supported.", "AGENT_MESSAGE_TYPE_INVALID", {
      message_type: messageType
    });
  }
  if (!text) {
    throw new TaskGraphSchedulerError("Agent message payload requires message text.", "AGENT_MESSAGE_TEXT_REQUIRED");
  }

  return {
    intent_id: intentId,
    from,
    runtime,
    action,
    to,
    message_type: messageType,
    team_context: teamContext,
    text,
    raw_payload: payload
  };
}

function classifyAgentMessage(message: AgentMessagePayload): AgentMessageIntakeResult["classification"] {
  return message.action === "delegate_to_member" ? "team_delegation" : "requirement_clarification_request";
}

export function extractClarificationQuestions(text: string): string[] {
  const questions = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .map((line) => line.replace(/^[-*]\s+/, ""))
    .map((line) => line.replace(/^\d+[.)、]\s*/, ""))
    .map((line) => line.replace(/^.+?\s+[—-]\s*/, ""))
    .filter((line) => line.includes("？") || line.includes("?"))
    .map((line) => line.trim());

  if (questions.length > 0) {
    return questions;
  }

  return text.trim().length > 0 ? [text.trim()] : [];
}

function firstString(payload: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseTeamContext(value: unknown): TeamContext | null {
  if (!isRecord(value)) {
    return null;
  }

  const teamNodeId = firstString(value, ["team_node_id"]);
  if (!teamNodeId) {
    return null;
  }

  return {
    team_node_id: teamNodeId,
    role: firstString(value, ["role"]) ?? undefined
  };
}

function isMessageType(value: string): value is MessageType {
  return messageTypes.includes(value as MessageType);
}
