import { createMailboxStore, type MailboxStore } from "../communication/mailbox_store.js";
import { createMessageBus } from "../communication/message_bus.js";
import type { Message } from "../models/message.js";
import { TaskGraphSchedulerError } from "../errors.js";

export interface PlannerReplyPayload {
  intent_id: string;
  from: string;
  text: string;
  raw_payload: unknown;
}

export interface PlannerReplyIntakeOptions {
  rootDir?: string;
  mailboxStore?: MailboxStore;
  now?: string;
}

export interface PlannerReplyIntakeResult {
  message: Message;
  annie_inbox_path: string;
  questions: string[];
}

export async function intakePlannerReply(
  payload: unknown,
  options: PlannerReplyIntakeOptions = {}
): Promise<PlannerReplyIntakeResult> {
  const reply = parsePlannerReplyPayload(payload);
  const rootDir = options.rootDir ?? ".annie";
  const mailboxStore = options.mailboxStore ?? createMailboxStore(rootDir);
  const bus = createMessageBus({
    mailbox_store: mailboxStore
  });
  const questions = extractClarificationQuestions(reply.text);
  const message = bus.createMessage({
    workflow_id: reply.intent_id,
    task_id: "planning",
    wave_id: "planning",
    from: reply.from,
    to: "annie",
    type: "REQUIREMENT_CLARIFICATION_REQUEST",
    priority: "high",
    payload: {
      intent_id: reply.intent_id,
      questions,
      reply_text: reply.text,
      raw_payload: reply.raw_payload
    },
    created_at: options.now
  });
  const delivered = await bus.sendMessage(message);

  return {
    message: delivered,
    annie_inbox_path: mailboxStore.mailboxPath(reply.intent_id, "annie", "inbox"),
    questions
  };
}

export function parsePlannerReplyPayload(payload: unknown): PlannerReplyPayload {
  if (!isRecord(payload)) {
    throw new TaskGraphSchedulerError("Planner reply payload must be an object.", "PLANNER_REPLY_PAYLOAD_INVALID");
  }

  const intentId = firstString(payload, ["intent_id", "workflow_id"]);
  const from = firstString(payload, ["from", "agent_id", "planner_agent_id"]);
  const text = firstString(payload, ["message", "text", "reply", "content"]);

  if (!intentId) {
    throw new TaskGraphSchedulerError("Planner reply payload requires intent_id.", "PLANNER_REPLY_INTENT_REQUIRED");
  }
  if (!from) {
    throw new TaskGraphSchedulerError("Planner reply payload requires from.", "PLANNER_REPLY_FROM_REQUIRED");
  }
  if (!text) {
    throw new TaskGraphSchedulerError("Planner reply payload requires message text.", "PLANNER_REPLY_TEXT_REQUIRED");
  }

  return {
    intent_id: intentId,
    from,
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
