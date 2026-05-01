import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { inboundLogPath, listCandidateNodes, listPlanProposals, listRegisteredNodes, receiveAgentMessage, receiveInboundPayload, receiveNodeRegistration, receivePlanProposal, receiveWorkflowBootstrap, receiveWorkflowNextWave } from "../src/server/inbound_server.js";
import { createRuntimeDiscoveryStore } from "../src/runtime_discovery/index.js";
import { createPlannerTeamSnapshot } from "../src/team/index.js";
import type { TransportAdapter } from "../src/communication/openclaw_adapter.js";
import type { Message } from "../src/models/message.js";

test("receiveInboundPayload writes OpenClaw messages to the inbound log", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "annie-tgs-inbound-"));
  const logPath = inboundLogPath(rootDir);

  const record = await receiveInboundPayload({
    type: "USER_MESSAGE",
    from: "openclaw",
    to: "annie",
    message: "Create a website"
  }, {
    logPath,
    rootDir,
    path: "/openclaw/messages",
    now: () => "2026-04-28T12:00:00.000Z"
  });

  assert.equal(record.received_at, "2026-04-28T12:00:00.000Z");
  assert.equal(record.path, "/openclaw/messages");
  assert.equal(record.intent.goal, "Create a website");
  assert.equal(record.intent.raw_message_ref.inbound_log_path, logPath);
  assert.equal(record.planner_handoff.planner_agent_id, "team-lead-agent");
  assert.equal(record.planner_handoff.message.type, "PLANNING_REQUEST");
  assert.equal(record.planner_handoff.message.status, "delivered");
  assert.equal(record.planner_handoff.message.payload.intent_id, record.intent.intent_id);

  const rawLog = await readFile(logPath, "utf8");
  const records = rawLog
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as {
      received_at: string;
      source: string;
      path: string;
      payload: { message: string };
    });

  assert.equal(records.length, 1);
  assert.equal(records[0]?.received_at, "2026-04-28T12:00:00.000Z");
  assert.equal(records[0]?.source, "openclaw");
  assert.equal(records[0]?.path, "/openclaw/messages");
  assert.equal(records[0]?.payload.message, "Create a website");

  const intent = JSON.parse(await readFile(record.intent_path, "utf8")) as {
    intent_id: string;
    goal: string;
  };
  assert.equal(intent.intent_id, record.intent.intent_id);
  assert.equal(intent.goal, "Create a website");

  const plannerInboxRaw = await readFile(record.planner_handoff.planner_inbox_path, "utf8");
  const plannerMessages = plannerInboxRaw
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as { type: string; payload: { goal: string } });
  assert.equal(plannerMessages.length, 1);
  assert.equal(plannerMessages[0]?.type, "PLANNING_REQUEST");
  assert.equal(plannerMessages[0]?.payload.goal, "Create a website");
});

test("receiveInboundPayload can hand off planning requests through injected OpenClaw transport", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "annie-tgs-inbound-openclaw-"));
  const logPath = inboundLogPath(rootDir);
  const sent: Message[] = [];
  const transport: TransportAdapter = {
    async send(message) {
      sent.push(message);
    }
  };

  const record = await receiveInboundPayload({
    type: "USER_MESSAGE",
    from: "openclaw",
    to: "annie",
    message: "Create a website"
  }, {
    logPath,
    rootDir,
    team: createPlannerTeamSnapshot("develop-team", "2026-04-30T00:00:00.000Z"),
    plannerTransport: transport,
    now: () => "2026-04-30T00:00:00.000Z"
  });

  assert.equal(record.planner_handoff.planner_agent_id, "develop-team");
  assert.equal(record.planner_handoff.message.status, "delivered");
  assert.equal(sent.length, 1);
  assert.equal(sent[0]?.to, "develop-team");
  assert.equal(sent[0]?.type, "PLANNING_REQUEST");
  assert.equal(sent[0]?.payload.intent_id, record.intent.intent_id);
});

test("receiveAgentMessage writes generic agent message to Annie inbox", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "annie-tgs-agent-message-endpoint-"));
  const record = await receiveAgentMessage({
    intent_id: "intent_002",
    from: "annie-dev",
    action: "send_message",
    to: "annie",
    message_type: "REQUIREMENT_CLARIFICATION_REQUEST",
    message: "范围确认 — 是否需要登录？"
  }, {
    rootDir,
    path: "/agent-messages",
    now: () => "2026-05-01T00:00:00.000Z"
  });

  assert.equal(record.path, "/agent-messages");
  assert.equal(record.agent_message.message.type, "REQUIREMENT_CLARIFICATION_REQUEST");
  assert.equal(record.agent_message.message.workflow_id, "intent_002");
  assert.equal(record.agent_message.message.from, "annie-dev");
  assert.equal(record.agent_message.message.to, "annie");
  assert.equal(record.agent_message.questions.length, 1);

  const inboxRaw = await readFile(record.agent_message.inbox_path, "utf8");
  const inboxMessages = inboxRaw
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as { type: string; from: string; to: string });
  assert.equal(inboxMessages.length, 1);
  assert.equal(inboxMessages[0]?.type, "REQUIREMENT_CLARIFICATION_REQUEST");
  assert.equal(inboxMessages[0]?.from, "annie-dev");
  assert.equal(inboxMessages[0]?.to, "annie");
});

test("receiveNodeRegistration stores runtime-neutral node proposals", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "annie-tgs-node-registration-"));
  const record = await receiveNodeRegistration({
    schema_version: "node-registration.v1",
    nodes: [
      {
        node_id: "develop-team",
        node_type: "team",
        requested_actions: ["send_message"]
      },
      {
        node_id: "annie-dev",
        node_type: "individual",
        requested_actions: ["send_message"]
      }
    ],
    team_compositions: [
      {
        team_node_id: "develop-team",
        lead_node_id: "annie-dev",
        members: [
          {
            node_id: "annie-dev",
            team_role: "lead_developer"
          }
        ]
      }
    ]
  }, {
    rootDir,
    now: () => "2026-05-01T03:00:00.000Z"
  });

  assert.equal(record.path, "/nodes/register");
  assert.equal(record.registered_at, "2026-05-01T03:00:00.000Z");
  assert.equal(record.snapshot.nodes.length, 2);
  assert.equal(record.snapshot.team_compositions.length, 1);
  assert.deepEqual(record.snapshot.nodes.find((node) => node.node_id === "develop-team")?.granted_actions, []);
});

test("listRegisteredNodes reads the snapshot used by GET /nodes", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "annie-tgs-node-list-"));
  await receiveNodeRegistration({
    schema_version: "node-registration.v1",
    nodes: [
      {
        node_id: "annie-dev",
        node_type: "individual",
        requested_actions: ["send_message"]
      }
    ]
  }, {
    rootDir,
    now: () => "2026-05-01T04:00:00.000Z"
  });

  const snapshot = await listRegisteredNodes({ rootDir });

  assert.equal(snapshot.nodes.length, 1);
  assert.equal(snapshot.nodes[0]?.node_id, "annie-dev");
  assert.equal(snapshot.team_compositions.length, 0);
});

test("listCandidateNodes reads the snapshot used by GET /nodes/candidates", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "annie-tgs-candidate-list-"));
  const store = createRuntimeDiscoveryStore(rootDir);
  await store.saveDiscovery({
    runtimes: [
      {
        runtime: "openclaw",
        status: "available",
        discovered_at: "2026-05-01T05:00:00.000Z"
      }
    ],
    candidates: [
      {
        candidate_id: "openclaw:annie-dev",
        runtime: "openclaw",
        runtime_ref: {
          agent_id: "annie-dev"
        },
        node_id_hint: "annie-dev",
        node_type_hint: "individual",
        declared_capabilities: ["frontend"],
        requested_actions: ["send_message"],
        discovered_at: "2026-05-01T05:00:00.000Z"
      }
    ]
  }, { now: "2026-05-01T05:00:00.000Z" });

  const snapshot = await listCandidateNodes({ rootDir });

  assert.equal(snapshot.runtimes[0]?.runtime, "openclaw");
  assert.equal(snapshot.candidates.length, 1);
  assert.equal(snapshot.candidates[0]?.candidate_id, "openclaw:annie-dev");
});

test("receivePlanProposal stores valid plan proposals", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "annie-tgs-plan-proposal-"));
  const record = await receivePlanProposal({
    intent_id: "intent_003",
    from: "develop-team",
    plan: {
      plan_id: "plan_site",
      plan_type: "dag",
      execution_policy: {},
      tasks: [
        {
          id: "T1",
          title: "Create homepage",
          depends_on: [],
          expected_files: ["src/home.ts"]
        }
      ]
    }
  }, {
    rootDir,
    now: () => "2026-05-01T06:00:00.000Z"
  });

  assert.equal(record.path, "/plan-proposals");
  assert.equal(record.proposal.intent_id, "intent_003");
  assert.equal(record.proposal.plan.plan_id, "plan_site");
  assert.equal(record.proposal.validation_status, "valid");

  const snapshot = await listPlanProposals({ rootDir });
  assert.equal(snapshot.proposals.length, 1);
  assert.equal(snapshot.proposals[0]?.proposal_id, record.proposal.proposal_id);
});

test("receiveWorkflowBootstrap bootstraps a saved plan proposal", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "annie-tgs-workflow-bootstrap-"));
  const proposalRecord = await receivePlanProposal({
    intent_id: "intent_004",
    from: "develop-team",
    plan: {
      plan_id: "plan_site",
      plan_type: "dag",
      execution_policy: {},
      tasks: [
        {
          id: "T1",
          title: "Create homepage",
          depends_on: [],
          expected_files: ["src/home.ts"]
        }
      ]
    }
  }, {
    rootDir,
    now: () => "2026-05-01T06:00:00.000Z"
  });

  const record = await receiveWorkflowBootstrap({
    proposal_id: proposalRecord.proposal.proposal_id,
    workflow_id: "wf_site"
  }, {
    rootDir,
    now: () => "2026-05-01T07:00:00.000Z"
  });

  assert.equal(record.path, "/workflow-bootstrap");
  assert.equal(record.bootstrap.workflow_id, "wf_site");
  assert.equal(record.bootstrap.state.status, "pending");
  assert.equal(record.bootstrap.state.waves.length, 0);
});

test("receiveWorkflowNextWave schedules a bootstrapped workflow", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "annie-tgs-workflow-next-wave-"));
  const proposalRecord = await receivePlanProposal({
    intent_id: "intent_005",
    from: "develop-team",
    plan: {
      plan_id: "plan_site",
      plan_type: "dag",
      execution_policy: {},
      tasks: [
        {
          id: "T1",
          title: "Create homepage",
          depends_on: [],
          expected_files: ["src/home.ts"]
        }
      ]
    }
  }, {
    rootDir,
    now: () => "2026-05-01T08:00:00.000Z"
  });

  await receiveWorkflowBootstrap({
    proposal_id: proposalRecord.proposal.proposal_id,
    workflow_id: "wf_site"
  }, {
    rootDir,
    now: () => "2026-05-01T09:00:00.000Z"
  });

  const record = await receiveWorkflowNextWave({
    workflow_id: "wf_site"
  }, {
    rootDir,
    now: () => "2026-05-01T10:00:00.000Z"
  });

  assert.equal(record.path, "/workflow-next-wave");
  assert.equal(record.scheduling.workflow_id, "wf_site");
  assert.equal(record.scheduling.decision.status, "scheduled");
  assert.equal(record.scheduling.next_wave?.wave?.id, "wave_001");
  assert.equal(record.scheduling.state.current_wave, "wave_001");
});
