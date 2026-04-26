import type { Message, MessageStatus, MessageType } from "../models/message.js";
import { defaultExecutionPolicy, type ExecutionPolicy } from "../models/plan.js";
import { TaskGraphSchedulerError } from "../errors.js";
import type { TransportAdapter } from "./openclaw_adapter.js";
import { MockAdapter } from "./openclaw_adapter.js";
import { createMailboxStore, type MailboxStore } from "./mailbox_store.js";
import { validateProtocolMessage } from "./protocol_validator.js";

export interface MessageDraft {
  workflow_id: string;
  task_id: string;
  wave_id: string;
  from: string;
  to: string;
  type: MessageType;
  priority?: Message["priority"];
  requires_ack?: boolean;
  payload?: Record<string, unknown>;
  created_at?: string;
}

export interface MessageBus {
  createMessage(draft: MessageDraft): Message;
  sendMessage(message: Message): Promise<Message>;
  acknowledgeMessage(message: Message, acknowledgedAt?: string): Promise<Message>;
  markProcessed(message: Message, processedAt?: string): Promise<Message>;
  retryDelivery(message: Message, now?: string): Promise<Message>;
}

export interface MessageBusOptions {
  mailbox_store?: MailboxStore;
  transport?: TransportAdapter;
  policy?: Partial<ExecutionPolicy>;
}

export function createMessageBus(options: MessageBusOptions = {}): MessageBus {
  return new LocalMessageBus(
    options.mailbox_store ?? createMailboxStore(),
    options.transport ?? new MockAdapter(),
    {
      ...defaultExecutionPolicy,
      ...options.policy
    }
  );
}

class LocalMessageBus implements MessageBus {
  constructor(
    private readonly mailboxStore: MailboxStore,
    private readonly transport: TransportAdapter,
    private readonly policy: ExecutionPolicy
  ) {}

  createMessage(draft: MessageDraft): Message {
    const createdAt = draft.created_at ?? new Date().toISOString();
    const message: Message = {
      message_id: `msg_${Date.parse(createdAt)}_${Math.random().toString(36).slice(2, 10)}`,
      workflow_id: draft.workflow_id,
      task_id: draft.task_id,
      wave_id: draft.wave_id,
      from: draft.from,
      to: draft.to,
      type: draft.type,
      priority: draft.priority ?? "normal",
      requires_ack: draft.requires_ack ?? this.policy.requires_ack_default,
      status: "created",
      delivery_attempts: 0,
      created_at: createdAt,
      acknowledged_at: null,
      processed_at: null,
      payload: draft.payload ?? {}
    };

    validateProtocolMessage(message);
    return message;
  }

  async sendMessage(message: Message): Promise<Message> {
    validateProtocolMessage(message);
    const queued = updateMessage(message, "queued", {
      delivery_attempts: message.delivery_attempts + 1
    });
    await this.mailboxStore.appendMessage(queued.workflow_id, queued.from, "outbox", queued);

    try {
      await this.transport.send(queued);
      const delivered = updateMessage(queued, "delivered");
      await this.mailboxStore.appendMessage(delivered.workflow_id, delivered.to, "inbox", delivered);
      return delivered;
    } catch (error) {
      const failed = updateMessage(queued, "failed", {
        payload: {
          ...queued.payload,
          delivery_error: error instanceof Error ? error.message : String(error)
        }
      });
      await this.mailboxStore.appendMessage(failed.workflow_id, failed.to, "inbox", failed);
      return failed;
    }
  }

  async acknowledgeMessage(message: Message, acknowledgedAt = new Date().toISOString()): Promise<Message> {
    const acknowledged = updateMessage(message, "acknowledged", {
      acknowledged_at: acknowledgedAt
    });
    await this.mailboxStore.appendMessage(acknowledged.workflow_id, acknowledged.to, "inbox", acknowledged);
    return acknowledged;
  }

  async markProcessed(message: Message, processedAt = new Date().toISOString()): Promise<Message> {
    const processed = updateMessage(message, "processed", {
      processed_at: processedAt
    });
    await this.mailboxStore.appendMessage(processed.workflow_id, processed.to, "inbox", processed);
    return processed;
  }

  async retryDelivery(message: Message, now = new Date().toISOString()): Promise<Message> {
    if (message.delivery_attempts >= this.policy.max_delivery_retries) {
      const failed = updateMessage(message, "failed", {
        payload: {
          ...message.payload,
          failed_at: now,
          failure_reason: "Maximum delivery retries reached."
        }
      });
      await this.mailboxStore.appendMessage(failed.workflow_id, failed.to, "inbox", failed);
      return failed;
    }

    return this.sendMessage(message);
  }
}

function updateMessage(
  message: Message,
  status: MessageStatus,
  patch: Partial<Message> = {}
): Message {
  return {
    ...message,
    ...patch,
    status
  };
}
