import { messageTypes, type Message } from "../models/message.js";
import { TaskGraphSchedulerError } from "../errors.js";

export function validateProtocolMessage(message: Message): void {
  if (!messageTypes.includes(message.type)) {
    throw new TaskGraphSchedulerError("Unsupported message type.", "MESSAGE_TYPE_INVALID", {
      type: message.type
    });
  }

  for (const field of ["message_id", "workflow_id", "task_id", "wave_id", "from", "to", "created_at"] as const) {
    if (typeof message[field] !== "string" || message[field].trim().length === 0) {
      throw new TaskGraphSchedulerError(`Message field ${field} is required.`, "MESSAGE_FIELD_REQUIRED", {
        field
      });
    }
  }

  if (typeof message.requires_ack !== "boolean") {
    throw new TaskGraphSchedulerError("Message requires_ack must be boolean.", "MESSAGE_FIELD_INVALID");
  }

  if (!Number.isInteger(message.delivery_attempts) || message.delivery_attempts < 0) {
    throw new TaskGraphSchedulerError("Message delivery_attempts must be a non-negative integer.", "MESSAGE_FIELD_INVALID");
  }

  if (!isDirectionAllowed(message)) {
    throw new TaskGraphSchedulerError("Message direction is not allowed.", "MESSAGE_DIRECTION_INVALID", {
      type: message.type,
      from: message.from,
      to: message.to
    });
  }
}

function isDirectionAllowed(message: Message): boolean {
  switch (message.type) {
    case "TASK_ASSIGNED":
    case "REVIEW_REQUESTED":
    case "APPROVAL_REQUIRED":
      return message.from === "orchestrator" && message.to !== "orchestrator";
    case "TASK_STARTED":
    case "TASK_PROGRESS":
    case "TASK_COMPLETED":
    case "TASK_FAILED":
    case "BLOCKER_REPORTED":
      return message.from !== "orchestrator" && message.to === "orchestrator";
    case "HELP_REQUESTED":
    case "QUESTION_ASKED":
    case "ANSWER_PROVIDED":
    case "REVIEW_COMMENT":
      return message.from !== message.to;
    default:
      return false;
  }
}
