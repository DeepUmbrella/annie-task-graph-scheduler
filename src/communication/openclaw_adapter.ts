import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { Message } from "../models/message.js";

const execFileAsync = promisify(execFile);

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

export interface OpenClawCommandResult {
  stdout: string;
  stderr: string;
}

export type OpenClawCommandRunner = (command: string, args: string[]) => Promise<OpenClawCommandResult>;

export interface OpenClawCliClientOptions {
  command?: string;
  runner?: OpenClawCommandRunner;
  local?: boolean;
  deliver?: boolean;
  thinking?: string;
  timeout_seconds?: number;
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

export class OpenClawCliClient implements OpenClawClient {
  constructor(private readonly options: OpenClawCliClientOptions = {}) {}

  async send(envelope: OpenClawEnvelope): Promise<void> {
    const command = this.options.command ?? "openclaw";
    const args = toOpenClawAgentArgs(envelope, this.options);
    const runner = this.options.runner ?? runOpenClawCommand;
    await runner(command, args);
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

export function toOpenClawAgentArgs(
  envelope: OpenClawEnvelope,
  options: OpenClawCliClientOptions = {}
): string[] {
  const args = [
    "agent",
    "--agent",
    envelope.target_agent,
    "--message",
    envelope.message,
    "--json"
  ];

  if (envelope.session_id) {
    args.push("--session-id", envelope.session_id);
  }
  if (options.local) {
    args.push("--local");
  }
  if (options.deliver) {
    args.push("--deliver");
  }
  if (options.thinking) {
    args.push("--thinking", options.thinking);
  }
  if (options.timeout_seconds !== undefined) {
    args.push("--timeout", String(options.timeout_seconds));
  }

  return args;
}

async function runOpenClawCommand(command: string, args: string[]): Promise<OpenClawCommandResult> {
  const result = await execFileAsync(command, args, {
    maxBuffer: 1024 * 1024 * 10
  });
  return {
    stdout: result.stdout,
    stderr: result.stderr
  };
}
