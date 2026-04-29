import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { TaskGraphSchedulerError } from "../errors.js";

export interface InboundServerOptions {
  host?: string;
  port?: number;
  rootDir?: string;
  now?: () => string;
}

export interface StartedInboundServer {
  server: Server;
  host: string;
  port: number;
  url: string;
  logPath: string;
}

export interface InboundMessageRecord {
  received_at: string;
  source: "openclaw";
  path: string;
  payload: unknown;
}

export interface ReceiveInboundPayloadOptions {
  logPath: string;
  path?: string;
  now?: () => string;
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
    logPath
  };
}

export function inboundLogPath(rootDir = ".annie"): string {
  return join(rootDir, "inbound", "openclaw-messages.jsonl");
}

async function handleInboundRequest(
  request: IncomingMessage,
  response: ServerResponse,
  options: { logPath: string; now: () => string }
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
      writeJson(response, 404, {
        ok: false,
        error: "NOT_FOUND"
      });
      return;
    }

    const payload = await readJsonBody(request);
    const record = await receiveInboundPayload(payload, {
      logPath: options.logPath,
      path: request.url,
      now: options.now
    });

    const messageSummary = summarizePayload(payload);
    console.info(`[annie-tgs:inbound] received OpenClaw message path=${request.url} summary=${messageSummary}`);
    console.info(`[annie-tgs:inbound] persisted ${options.logPath}`);

    writeJson(response, 202, {
      ok: true,
      received_at: record.received_at,
      log_path: options.logPath
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

export async function receiveInboundPayload(
  payload: unknown,
  options: ReceiveInboundPayloadOptions
): Promise<InboundMessageRecord> {
  const record: InboundMessageRecord = {
    received_at: (options.now ?? (() => new Date().toISOString()))(),
    source: "openclaw",
    path: options.path ?? "/openclaw/messages",
    payload
  };

  await appendInboundRecord(options.logPath, record);
  return record;
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
