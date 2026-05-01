import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { TaskGraphSchedulerError } from "../errors.js";
import type { TransportAdapter } from "../communication/openclaw_adapter.js";
import { intakeAgentMessage, type AgentMessageIntakeResult } from "../agent_message/index.js";
import { createWorkflowIntentFromInboundPayload, intentsDir, type WorkflowIntent } from "../intake/index.js";
import { handoffIntentToPlanner, type PlannerHandoffResult } from "../planning/index.js";
import { createDefaultTeamSnapshot, type TeamSnapshot } from "../team/index.js";
import { createNodeRegistry, type NodeRegistrationProposal, type NodeRegistrySnapshot } from "../node_registry/index.js";
import { createRuntimeDiscoveryStore, type RuntimeDiscoverySnapshot } from "../runtime_discovery/index.js";
import { createPlanProposalStore, parsePlanProposalPayload, type PlanProposal, type PlanProposalSnapshot } from "../plan_proposal/index.js";
import { bootstrapWorkflowFromProposal, type WorkflowBootstrapResult } from "../workflow_bootstrap/index.js";
import { scheduleNextWorkflowWave, type WorkflowSchedulingResult } from "../workflow_scheduling/index.js";

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
  nodeRegistryPath: string;
  runtimeDiscoveryPath: string;
  planProposalsPath: string;
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

export interface NodeRegistrationResult {
  registered_at: string;
  path: string;
  payload: NodeRegistrationProposal;
  registry_path: string;
  snapshot: NodeRegistrySnapshot;
}

export interface ReceivedPlanProposal {
  received_at: string;
  path: string;
  payload: unknown;
  proposal: PlanProposal;
  proposals_path: string;
}

export interface ReceivedWorkflowBootstrap {
  received_at: string;
  path: string;
  payload: unknown;
  bootstrap: WorkflowBootstrapResult;
}

export interface ReceivedWorkflowNextWave {
  received_at: string;
  path: string;
  payload: unknown;
  scheduling: WorkflowSchedulingResult;
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
    intentsDir: intentsDir(rootDir),
    nodeRegistryPath: createNodeRegistry(rootDir).registryPath(),
    runtimeDiscoveryPath: createRuntimeDiscoveryStore(rootDir).snapshotPath(),
    planProposalsPath: createPlanProposalStore(rootDir).proposalsPath()
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

    if (request.method === "GET" && request.url === "/nodes") {
      const snapshot = await listRegisteredNodes({
        rootDir: options.rootDir
      });
      writeJson(response, 200, {
        ok: true,
        ...snapshot
      });
      return;
    }

    if (request.method === "GET" && request.url === "/nodes/candidates") {
      const snapshot = await listCandidateNodes({
        rootDir: options.rootDir
      });
      writeJson(response, 200, {
        ok: true,
        ...snapshot
      });
      return;
    }

    if (request.method === "GET" && request.url === "/plan-proposals") {
      const snapshot = await listPlanProposals({
        rootDir: options.rootDir
      });
      writeJson(response, 200, {
        ok: true,
        ...snapshot
      });
      return;
    }

    if (request.method !== "POST" || (request.url !== "/openclaw/messages" && request.url !== "/annie/messages")) {
      if (request.method === "POST" && request.url === "/workflow-bootstrap") {
        const payload = await readJsonBody(request);
        const record = await receiveWorkflowBootstrap(payload, {
          rootDir: options.rootDir,
          path: request.url,
          now: options.now
        });
        console.info(`[annie-tgs:workflow-bootstrap] workflow_id=${record.bootstrap.workflow_id} proposal_id=${record.bootstrap.proposal.proposal_id} state=${record.bootstrap.state_path}`);
        writeJson(response, 202, {
          ok: true,
          received_at: record.received_at,
          workflow_id: record.bootstrap.workflow_id,
          proposal_id: record.bootstrap.proposal.proposal_id,
          plan_id: record.bootstrap.state.plan_id,
          workflow_status: record.bootstrap.state.status,
          state_path: record.bootstrap.state_path,
          audit_path: record.bootstrap.audit_path
        });
        return;
      }

      if (request.method === "POST" && request.url === "/workflow-next-wave") {
        const payload = await readJsonBody(request);
        const record = await receiveWorkflowNextWave(payload, {
          rootDir: options.rootDir,
          path: request.url,
          now: options.now
        });
        console.info(`[annie-tgs:workflow-next-wave] workflow_id=${record.scheduling.workflow_id} decision=${record.scheduling.decision.status} wave_id=${record.scheduling.decision.wave_id ?? "none"} state=${record.scheduling.state_path}`);
        writeJson(response, 202, {
          ok: true,
          received_at: record.received_at,
          workflow_id: record.scheduling.workflow_id,
          decision: record.scheduling.decision,
          wave: record.scheduling.next_wave?.wave ?? null,
          state_path: record.scheduling.state_path,
          audit_path: record.scheduling.audit_path
        });
        return;
      }

      if (request.method === "POST" && request.url === "/plan-proposals") {
        const payload = await readJsonBody(request);
        const record = await receivePlanProposal(payload, {
          rootDir: options.rootDir,
          path: request.url,
          now: options.now
        });
        console.info(`[annie-tgs:plan-proposal] received proposal_id=${record.proposal.proposal_id} intent_id=${record.proposal.intent_id} from=${record.proposal.from} path=${record.proposals_path}`);
        writeJson(response, 202, {
          ok: true,
          received_at: record.received_at,
          proposal_id: record.proposal.proposal_id,
          intent_id: record.proposal.intent_id,
          from: record.proposal.from,
          plan_id: record.proposal.plan.plan_id,
          validation_status: record.proposal.validation_status,
          proposals_path: record.proposals_path
        });
        return;
      }

      if (request.method === "POST" && request.url === "/nodes/register") {
        const payload = await readJsonBody(request);
        const record = await receiveNodeRegistration(payload, {
          rootDir: options.rootDir,
          path: request.url,
          now: options.now
        });
        console.info(`[annie-tgs:nodes] registered nodes=${record.snapshot.nodes.length} teams=${record.snapshot.team_compositions.length} registry=${record.registry_path}`);
        writeJson(response, 202, {
          ok: true,
          registered_at: record.registered_at,
          node_count: record.snapshot.nodes.length,
          team_count: record.snapshot.team_compositions.length,
          registry_path: record.registry_path
        });
        return;
      }

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

export async function receiveWorkflowBootstrap(
  payload: unknown,
  options: {
    rootDir?: string;
    path?: string;
    now?: () => string;
  } = {}
): Promise<ReceivedWorkflowBootstrap> {
  const receivedAt = (options.now ?? (() => new Date().toISOString()))();
  const input = parseWorkflowBootstrapPayload(payload);
  const bootstrap = await bootstrapWorkflowFromProposal(input, {
    rootDir: options.rootDir,
    now: receivedAt
  });

  return {
    received_at: receivedAt,
    path: options.path ?? "/workflow-bootstrap",
    payload,
    bootstrap
  };
}

export async function receiveWorkflowNextWave(
  payload: unknown,
  options: {
    rootDir?: string;
    path?: string;
    now?: () => string;
  } = {}
): Promise<ReceivedWorkflowNextWave> {
  const receivedAt = (options.now ?? (() => new Date().toISOString()))();
  const input = parseWorkflowNextWavePayload(payload);
  const scheduling = await scheduleNextWorkflowWave(input, {
    rootDir: options.rootDir,
    now: receivedAt
  });

  return {
    received_at: receivedAt,
    path: options.path ?? "/workflow-next-wave",
    payload,
    scheduling
  };
}

function parseWorkflowNextWavePayload(payload: unknown): { workflow_id: string } {
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    throw new TaskGraphSchedulerError("Workflow next-wave payload must be an object.", "WORKFLOW_NEXT_WAVE_PAYLOAD_INVALID");
  }

  const record = payload as Record<string, unknown>;
  const workflowId = typeof record.workflow_id === "string" ? record.workflow_id.trim() : "";

  if (workflowId.length === 0) {
    throw new TaskGraphSchedulerError("Workflow next-wave payload requires workflow_id.", "WORKFLOW_NEXT_WAVE_WORKFLOW_REQUIRED");
  }

  return {
    workflow_id: workflowId
  };
}

function parseWorkflowBootstrapPayload(payload: unknown): { proposal_id: string; workflow_id?: string } {
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    throw new TaskGraphSchedulerError("Workflow bootstrap payload must be an object.", "WORKFLOW_BOOTSTRAP_PAYLOAD_INVALID");
  }

  const record = payload as Record<string, unknown>;
  const proposalId = typeof record.proposal_id === "string" ? record.proposal_id.trim() : "";
  const workflowId = typeof record.workflow_id === "string" && record.workflow_id.trim().length > 0
    ? record.workflow_id.trim()
    : undefined;

  if (proposalId.length === 0) {
    throw new TaskGraphSchedulerError("Workflow bootstrap payload requires proposal_id.", "WORKFLOW_BOOTSTRAP_PROPOSAL_REQUIRED");
  }

  return {
    proposal_id: proposalId,
    workflow_id: workflowId
  };
}

export async function receivePlanProposal(
  payload: unknown,
  options: {
    rootDir?: string;
    path?: string;
    now?: () => string;
  } = {}
): Promise<ReceivedPlanProposal> {
  const receivedAt = (options.now ?? (() => new Date().toISOString()))();
  const store = createPlanProposalStore(options.rootDir);
  const parsed = parsePlanProposalPayload(payload);
  const proposal = await store.saveProposal(parsed, {
    now: receivedAt
  });

  return {
    received_at: receivedAt,
    path: options.path ?? "/plan-proposals",
    payload,
    proposal,
    proposals_path: store.proposalsPath()
  };
}

export async function listPlanProposals(options: {
  rootDir?: string;
} = {}): Promise<PlanProposalSnapshot> {
  return createPlanProposalStore(options.rootDir).loadSnapshot();
}

export async function receiveNodeRegistration(
  payload: unknown,
  options: {
    rootDir?: string;
    path?: string;
    now?: () => string;
  } = {}
): Promise<NodeRegistrationResult> {
  const registeredAt = (options.now ?? (() => new Date().toISOString()))();
  const registry = createNodeRegistry(options.rootDir);
  const proposal = payload as NodeRegistrationProposal;
  const snapshot = await registry.registerProposal(proposal, {
    now: registeredAt
  });

  return {
    registered_at: registeredAt,
    path: options.path ?? "/nodes/register",
    payload: proposal,
    registry_path: registry.registryPath(),
    snapshot
  };
}

export async function listRegisteredNodes(options: {
  rootDir?: string;
} = {}): Promise<NodeRegistrySnapshot> {
  return createNodeRegistry(options.rootDir).loadSnapshot();
}

export async function listCandidateNodes(options: {
  rootDir?: string;
} = {}): Promise<RuntimeDiscoverySnapshot> {
  return createRuntimeDiscoveryStore(options.rootDir).loadSnapshot();
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
