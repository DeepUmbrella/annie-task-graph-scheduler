import { createMailboxStore, type MailboxStore } from "../communication/mailbox_store.js";
import { createMessageBus } from "../communication/message_bus.js";
import type { Message } from "../models/message.js";
import { TaskGraphSchedulerError } from "../errors.js";

export interface AgentMessagePayload {
  intent_id: string;
  from: string;
  to: string;
  text: string;
  raw_payload: unknown;
}

export interface AgentMessageIntakeOptions {
  rootDir?: string;
  mailboxStore?: MailboxStore;
  now?: string;
}

export interface AgentMessageIntakeResult {
  message: Message;
  inbox_path: string;
  questions: string[];
  classification: "requirement_clarification_request";
}

export async function intakeAgentMessage(
  payload: unknown,
  options: AgentMessageIntakeOptions = {}
): Promise<AgentMessageIntakeResult> {
  const agentMessage = parseAgentMessagePayload(payload);
  const rootDir = options.rootDir ?? ".annie";
  const mailboxStore = options.mailboxStore ?? createMailboxStore(rootDir);
  const bus = createMessageBus({
    mailbox_store: mailboxStore
  });
  const questions = extractClarificationQuestions(agentMessage.text);
  const message = bus.createMessage({
    workflow_id: agentMessage.intent_id,
    task_id: "planning",
    wave_id: "planning",
    from: agentMessage.from,
    to: agentMessage.to,
    type: "REQUIREMENT_CLARIFICATION_REQUEST",
    priority: "high",
    payload: {
      intent_id: agentMessage.intent_id,
      questions,
      reply_text: agentMessage.text,
      raw_payload: agentMessage.raw_payload,
      classification: "requirement_clarification_request"
    },
    created_at: options.now
  });
  const delivered = await bus.sendMessage(message);

  return {
    message: delivered,
    inbox_path: mailboxStore.mailboxPath(agentMessage.intent_id, agentMessage.to, "inbox"),
    questions,
    classification: "requirement_clarification_request"
  };
}

export function parseAgentMessagePayload(payload: unknown): AgentMessagePayload {
  if (!isRecord(payload)) {
    throw new TaskGraphSchedulerError("Agent message payload must be an object.", "AGENT_MESSAGE_PAYLOAD_INVALID");
  }

  const intentId = firstString(payload, ["intent_id", "workflow_id"]);
  const from = firstString(payload, ["from", "agent_id", "planner_agent_id"]);
  const to = firstString(payload, ["to", "target", "recipient"]) ?? "annie";
  const text = firstString(payload, ["message", "text", "reply", "content"]);

  if (!intentId) {
    throw new TaskGraphSchedulerError("Agent message payload requires intent_id.", "AGENT_MESSAGE_INTENT_REQUIRED");
  }
  if (!from) {
    throw new TaskGraphSchedulerError("Agent message payload requires from.", "AGENT_MESSAGE_FROM_REQUIRED");
  }
  if (!text) {
    throw new TaskGraphSchedulerError("Agent message payload requires message text.", "AGENT_MESSAGE_TEXT_REQUIRED");
  }

  return {
    intent_id: intentId,
    from,
    to,
    text,
    raw_payload: payload
  };
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
