import type { Message } from "../models/message.js";
import {
  extractClarificationQuestions,
  intakeAgentMessage,
  parseAgentMessagePayload,
  type AgentMessageIntakeOptions
} from "../agent_message/index.js";
import { TaskGraphSchedulerError } from "../errors.js";

export interface PlannerReplyPayload {
  intent_id: string;
  from: string;
  text: string;
  raw_payload: unknown;
}

export interface PlannerReplyIntakeOptions {
  rootDir?: AgentMessageIntakeOptions["rootDir"];
  mailboxStore?: AgentMessageIntakeOptions["mailboxStore"];
  now?: AgentMessageIntakeOptions["now"];
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
  const result = await intakeAgentMessage(payload, options);

  return {
    message: result.message,
    annie_inbox_path: result.inbox_path,
    questions: result.questions
  };
}

export function parsePlannerReplyPayload(payload: unknown): PlannerReplyPayload {
  let parsed;
  try {
    parsed = parseAgentMessagePayload(payload);
  } catch (error) {
    if (error instanceof TaskGraphSchedulerError) {
      throw mapAgentMessageErrorToPlannerReplyError(error);
    }
    throw error;
  }

  return {
    intent_id: parsed.intent_id,
    from: parsed.from,
    text: parsed.text,
    raw_payload: parsed.raw_payload
  };
}

export { extractClarificationQuestions };

function mapAgentMessageErrorToPlannerReplyError(error: TaskGraphSchedulerError): TaskGraphSchedulerError {
  const codeMap: Record<string, string> = {
    AGENT_MESSAGE_PAYLOAD_INVALID: "PLANNER_REPLY_PAYLOAD_INVALID",
    AGENT_MESSAGE_INTENT_REQUIRED: "PLANNER_REPLY_INTENT_REQUIRED",
    AGENT_MESSAGE_FROM_REQUIRED: "PLANNER_REPLY_FROM_REQUIRED",
    AGENT_MESSAGE_TEXT_REQUIRED: "PLANNER_REPLY_TEXT_REQUIRED"
  };

  return new TaskGraphSchedulerError(error.message.replace("Agent message", "Planner reply"), codeMap[error.code] ?? error.code, error.details);
}
