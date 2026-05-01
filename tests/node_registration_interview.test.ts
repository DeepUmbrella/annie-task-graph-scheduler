import test from "node:test";
import assert from "node:assert/strict";
import {
  approveNodeRegistrationProposal,
  createDenyAllRegistrationApprovalPolicy,
  createNodeRegistrationInterviewRequest,
  parseNodeRegistrationProposalReply
} from "../src/node_registration_interview/index.js";
import type { CandidateNode } from "../src/runtime_discovery/index.js";
import { TaskGraphSchedulerError } from "../src/errors.js";

function createCandidate(overrides: Partial<CandidateNode> = {}): CandidateNode {
  return {
    candidate_id: "openclaw:develop-team",
    runtime: "openclaw",
    runtime_ref: {
      agent_id: "develop-team"
    },
    node_id_hint: "develop-team",
    node_type_hint: "team",
    display_name: "Develop Team",
    declared_capabilities: ["planning", "delivery"],
    requested_actions: ["send_message"],
    discovered_at: "2026-05-01T00:00:00.000Z",
    ...overrides
  };
}

test("createNodeRegistrationInterviewRequest builds a stable schema request", () => {
  const request = createNodeRegistrationInterviewRequest(createCandidate());

  assert.equal(request.schema_version, "node-registration-interview.v1");
  assert.equal(request.required_response_schema, "node-registration.v1");
  assert.equal(request.candidate_id, "openclaw:develop-team");
  assert.equal(request.runtime, "openclaw");
  assert.equal(request.node_id_hint, "develop-team");
  assert.equal(request.node_type_hint, "team");
  assert.match(request.prompt, /node-registration\.v1/);
  assert.match(request.prompt, /requested_actions/);
  assert.match(request.requested_actions_note, /granted_actions/);
});

test("parseNodeRegistrationProposalReply accepts object replies", () => {
  const parsed = parseNodeRegistrationProposalReply({
    schema_version: "node-registration.v1",
    nodes: [
      {
        node_id: "annie-dev",
        node_type: "individual",
        requested_actions: ["send_message"]
      }
    ]
  });

  assert.equal(parsed.proposal.nodes[0]?.node_id, "annie-dev");
});

test("parseNodeRegistrationProposalReply accepts fenced json text", () => {
  const parsed = parseNodeRegistrationProposalReply({
    content: [
      "```json",
      JSON.stringify({
        schema_version: "node-registration.v1",
        nodes: [
          {
            node_id: "annie-dev",
            node_type: "individual",
            requested_actions: ["send_message"]
          }
        ]
      }),
      "```"
    ].join("\n")
  });

  assert.equal(parsed.proposal.schema_version, "node-registration.v1");
  assert.equal(parsed.proposal.nodes[0]?.node_id, "annie-dev");
});

test("parseNodeRegistrationProposalReply rejects invalid json", () => {
  assert.throws(
    () => parseNodeRegistrationProposalReply("```json\n{bad-json}\n```"),
    (error) => error instanceof TaskGraphSchedulerError
      && error.code === "NODE_REGISTRATION_REPLY_JSON_INVALID"
  );
});

test("parseNodeRegistrationProposalReply rejects invalid proposal schema", () => {
  assert.throws(
    () => parseNodeRegistrationProposalReply({
      schema_version: "node-registration.v2",
      nodes: []
    }),
    (error) => error instanceof TaskGraphSchedulerError
      && error.code === "NODE_REGISTRATION_SCHEMA_INVALID"
  );
});

test("approveNodeRegistrationProposal denies actions by default", () => {
  const proposal = {
    schema_version: "node-registration.v1" as const,
    nodes: [
      {
        node_id: "annie-dev",
        node_type: "individual" as const,
        declared_capabilities: ["frontend"],
        requested_actions: ["send_message" as const]
      }
    ]
  };

  const approved = approveNodeRegistrationProposal(proposal, createDenyAllRegistrationApprovalPolicy());

  assert.deepEqual(approved.nodes[0]?.declared_capabilities, ["frontend"]);
  assert.deepEqual(approved.nodes[0]?.requested_actions, ["send_message"]);
  assert.deepEqual(approved.nodes[0]?.granted_actions, []);
});

test("approveNodeRegistrationProposal grants only allowed requested actions", () => {
  const proposal = {
    schema_version: "node-registration.v1" as const,
    nodes: [
      {
        node_id: "develop-team",
        node_type: "team" as const,
        requested_actions: ["send_message" as const]
      },
      {
        node_id: "review-agent",
        node_type: "individual" as const,
        requested_actions: ["send_message" as const]
      }
    ]
  };

  const approved = approveNodeRegistrationProposal(proposal, {
    default_granted_actions: [],
    node_grants: {
      "develop-team": ["send_message"]
    }
  });

  assert.deepEqual(approved.nodes.find((node) => node.node_id === "develop-team")?.granted_actions, ["send_message"]);
  assert.deepEqual(approved.nodes.find((node) => node.node_id === "review-agent")?.granted_actions, []);
});
