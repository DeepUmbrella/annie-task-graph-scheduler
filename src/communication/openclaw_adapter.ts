import type { Message } from "../models/message.js";

export interface TransportAdapter {
  send(message: Message): Promise<void>;
}

export interface OpenClawEnvelope {
  session_id?: string;
  target_agent: string;
  message: string;
  metadata: {
    message_id: string;
    workflow_id: string;
    task_id: string;
    wave_id: string;
    type: string;
    from: string;
    to: string;
    priority: string;
    requires_ack: boolean;
  };
}

export interface OpenClawClient {
  send(envelope: OpenClawEnvelope): Promise<void>;
}

export interface OpenClawAdapterOptions {
  agent_sessions?: Record<string, string>;
}

export class OpenClawAdapter implements TransportAdapter {
  constructor(
    private readonly client: OpenClawClient,
    private readonly options: OpenClawAdapterOptions = {}
  ) {}

  async send(message: Message): Promise<void> {
    await this.client.send(toOpenClawEnvelope(message, this.options.agent_sessions ?? {}));
  }
}

export class MockAdapter implements TransportAdapter {
  public readonly sent: Message[] = [];

  async send(message: Message): Promise<void> {
    this.sent.push(message);
  }
}

export function toOpenClawEnvelope(
  message: Message,
  agentSessions: Record<string, string> = {}
): OpenClawEnvelope {
  return {
    session_id: agentSessions[message.to],
    target_agent: message.to,
    message: JSON.stringify({
      type: message.type,
      payload: message.payload
    }),
    metadata: {
      message_id: message.message_id,
      workflow_id: message.workflow_id,
      task_id: message.task_id,
      wave_id: message.wave_id,
      type: message.type,
      from: message.from,
      to: message.to,
      priority: message.priority,
      requires_ack: message.requires_ack
    }
  };
}
