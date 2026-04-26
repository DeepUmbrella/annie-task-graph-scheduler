export const messageTypes = [
  "TASK_ASSIGNED",
  "TASK_STARTED",
  "TASK_PROGRESS",
  "TASK_COMPLETED",
  "TASK_FAILED",
  "HELP_REQUESTED",
  "QUESTION_ASKED",
  "ANSWER_PROVIDED",
  "REVIEW_REQUESTED",
  "REVIEW_COMMENT",
  "BLOCKER_REPORTED",
  "APPROVAL_REQUIRED"
] as const;

export type MessageType = (typeof messageTypes)[number];

export const messageStatuses = [
  "created",
  "queued",
  "delivered",
  "acknowledged",
  "processed",
  "failed",
  "expired"
] as const;

export type MessageStatus = (typeof messageStatuses)[number];

export interface Message {
  message_id: string;
  workflow_id: string;
  task_id: string;
  wave_id: string;
  from: string;
  to: string;
  type: MessageType;
  priority: "low" | "normal" | "high" | "critical";
  requires_ack: boolean;
  status: MessageStatus;
  delivery_attempts: number;
  created_at: string;
  acknowledged_at: string | null;
  processed_at: string | null;
  payload: Record<string, unknown>;
}
