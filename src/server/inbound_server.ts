import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { TaskGraphSchedulerError } from "../errors.js";
import type { TransportAdapter } from "../communication/openclaw_adapter.js";
import { intakeAgentMessage, type AgentMessageIntakeResult } from "../agent_message/index.js";
import { createWorkflowIntentFromInboundPayload, intentsDir, type WorkflowIntent } from "../intake/index.js";
import { handoffIntentToPlanner, type PlannerHandoffResult } from "../planning/index.js";
import { createDefaultTeamSnapshot, type TeamSnapshot } from "../team/index.js";

export interface InboundServerOptions {
  host?: string;
  port?: number;
  rootDir?: string;
  team?: TeamSnapshot;
  plannerTransport?: TransportAdapter;
  now?: () => string;
}

export interface StartedInboundServer {
  server: Server;
  host: string;
  port: number;
  url: string;
  logPath: string;
  intentsDir: string;
}

export interface InboundMessageRecord {
  received_at: string;
  source: "openclaw";
  path: string;
  payload: unknown;
}

export interface ReceiveInboundPayloadOptions {
  logPath: string;
  rootDir?: string;
  path?: string;
  team?: TeamSnapshot;
  plannerTransport?: TransportAdapter;
  now?: () => string;
}

export interface ReceivedInboundPayload extends InboundMessageRecord {
  intent: WorkflowIntent;
  intent_path: string;
  planner_handoff: PlannerHandoffResult;
}

export interface ReceivedAgentMessage {
  received_at: string;
  path: string;
  payload: unknown;
  agent_message: AgentMessageIntakeResult;
}

export async function startInboundServer(options: InboundServerOptions = {}): Promise<StartedInboundServer> {
  const host = options.host ?? "127.0.0.1";
  const port = options.port ?? 4317;
  const rootDir = options.rootDir ?? ".annie";
  const logPath = inboundLogPath(rootDir);
  const now = options.now ?? (() => new Date().toISOString());

  const server = createServer((request, response) => {
    void handleInboundRequest(request, response, {
      logPath,
      rootDir,
      team: options.team,
      plannerTransport: options.plannerTransport,
      now
    });
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      server.off("error", reject);
      resolve();
    });
  });

  const address = server.address();
  const actualPort = typeof address === "object" && address ? address.port : port;

  return {
    server,
    host,
    port: actualPort,
    url: `http://${host}:${actualPort}`,
    logPath,
    intentsDir: intentsDir(rootDir)
  };
}

export function inboundLogPath(rootDir = ".annie"): string {
  return join(rootDir, "inbound", "openclaw-messages.jsonl");
}

async function handleInboundRequest(
  request: IncomingMessage,
  response: ServerResponse,
  options: {
    logPath: string;
    rootDir: string;
    team?: TeamSnapshot;
    plannerTransport?: TransportAdapter;
    now: () => string;
  }
): Promise<void> {
  try {
    if (request.method === "GET" && request.url === "/health") {
      writeJson(response, 200, {
        ok: true,
        service: "annie-task-graph-scheduler"
      });
      return;
    }

    if (request.method !== "POST" || (request.url !== "/openclaw/messages" && request.url !== "/annie/messages")) {
      if (request.method === "POST" && request.url === "/agent-messages") {
        const payload = await readJsonBody(request);
        const record = await receiveAgentMessage(payload, {
          rootDir: options.rootDir,
          path: request.url,
          now: options.now
        });
        console.info(`[annie-tgs:agent-message] received from=${record.agent_message.message.from} intent_id=${record.agent_message.message.workflow_id} type=${record.agent_message.message.type} questions=${record.agent_message.questions.length} inbox=${record.agent_message.inbox_path}`);
        writeJson(response, 202, {
          ok: true,
          received_at: record.received_at,
          intent_id: record.agent_message.message.workflow_id,
          from: record.agent_message.message.from,
          to: record.agent_message.message.to,
          message_type: record.agent_message.message.type,
          classification: record.agent_message.classification,
          agent_message_id: record.agent_message.message.message_id,
          delivery_status: record.agent_message.message.status,
          clarification_message_id: record.agent_message.message.message_id,
          clarification_delivery_status: record.agent_message.message.status,
          question_count: record.agent_message.questions.length,
          inbox_path: record.agent_message.inbox_path,
          annie_inbox_path: record.agent_message.inbox_path
        });
        return;
      }

      writeJson(response, 404, {
        ok: false,
        error: "NOT_FOUND"
      });
      return;
    }

    const payload = await readJsonBody(request);
    const record = await receiveInboundPayload(payload, {
      logPath: options.logPath,
      rootDir: options.rootDir,
      path: request.url,
      team: options.team,
      plannerTransport: options.plannerTransport,
      now: options.now
    });

    const messageSummary = summarizePayload(payload);
    console.info(`[annie-tgs:inbound] received OpenClaw message path=${request.url} summary=${messageSummary}`);
    console.info(`[annie-tgs:inbound] persisted ${options.logPath}`);
    console.info(`[annie-tgs:intent] created intent_id=${record.intent.intent_id} goal=${JSON.stringify(record.intent.goal)} path=${record.intent_path}`);
    console.info(`[annie-tgs:planner] handed off intent_id=${record.intent.intent_id} to=${record.planner_handoff.planner_agent_id} status=${record.planner_handoff.message.status} inbox=${record.planner_handoff.planner_inbox_path}`);

    writeJson(response, 202, {
      ok: true,
      received_at: record.received_at,
      log_path: options.logPath,
      intent_id: record.intent.intent_id,
      intent_path: record.intent_path,
      planner_agent_id: record.planner_handoff.planner_agent_id,
      planner_delivery_status: record.planner_handoff.message.status,
      planner_inbox_path: record.planner_handoff.planner_inbox_path,
      planning_message_id: record.planner_handoff.message.message_id
    });
  } catch (error) {
    const details = error instanceof TaskGraphSchedulerError
      ? { code: error.code, details: error.details }
      : { code: "INBOUND_MESSAGE_FAILED" };
    writeJson(response, 400, {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      ...details
    });
  }
}

export async function receiveAgentMessage(
  payload: unknown,
  options: {
    rootDir?: string;
    path?: string;
    now?: () => string;
  } = {}
): Promise<ReceivedAgentMessage> {
  const receivedAt = (options.now ?? (() => new Date().toISOString()))();
  const agentMessage = await intakeAgentMessage(payload, {
    rootDir: options.rootDir,
    now: receivedAt
  });

  return {
    received_at: receivedAt,
    path: options.path ?? "/agent-messages",
    payload,
    agent_message: agentMessage
  };
}

export async function receiveInboundPayload(
  payload: unknown,
  options: ReceiveInboundPayloadOptions
): Promise<ReceivedInboundPayload> {
  const record: InboundMessageRecord = {
    received_at: (options.now ?? (() => new Date().toISOString()))(),
    source: "openclaw",
    path: options.path ?? "/openclaw/messages",
    payload
  };

  await appendInboundRecord(options.logPath, record);
  const created = await createWorkflowIntentFromInboundPayload(payload, {
    rootDir: options.rootDir,
    inboundLogPath: options.logPath,
    receivedAt: record.received_at,
    now: record.received_at
  });
  const plannerHandoff = await handoffIntentToPlanner(created.intent, options.team ?? createDefaultTeamSnapshot(record.received_at), {
    rootDir: options.rootDir,
    transport: options.plannerTransport,
    now: record.received_at
  });

  return {
    ...record,
    intent: created.intent,
    intent_path: created.path,
    planner_handoff: plannerHandoff
  };
}

async function appendInboundRecord(logPath: string, record: InboundMessageRecord): Promise<void> {
  await mkdir(dirname(logPath), { recursive: true });
  await writeFile(logPath, `${JSON.stringify(record)}\n`, {
    encoding: "utf8",
    flag: "a"
  });
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let totalBytes = 0;

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buffer.length;

    if (totalBytes > 1024 * 1024) {
      throw new TaskGraphSchedulerError("Inbound message body is too large.", "INBOUND_BODY_TOO_LARGE", {
        max_bytes: 1024 * 1024
      });
    }

    chunks.push(buffer);
  }

  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (raw.length === 0) {
    return {};
  }

  try {
    return JSON.parse(raw) as unknown;
  } catch (error) {
    throw new TaskGraphSchedulerError("Inbound message body must be valid JSON.", "INBOUND_JSON_INVALID", {
      cause: error instanceof Error ? error.message : String(error)
    });
  }
}

function writeJson(response: ServerResponse, statusCode: number, payload: unknown): void {
  response.writeHead(statusCode, {
    "content-type": "application/json"
  });
  response.end(`${JSON.stringify(payload, null, 2)}\n`);
}

function summarizePayload(payload: unknown): string {
  if (typeof payload !== "object" || payload === null) {
    return JSON.stringify(payload);
  }

  const record = payload as Record<string, unknown>;
  const keys = ["type", "from", "to", "message", "text", "goal"].filter((key) => key in record);
  if (keys.length === 0) {
    return `keys=${Object.keys(record).join(",") || "none"}`;
  }

  return keys.map((key) => `${key}=${JSON.stringify(record[key])}`).join(" ");
}
