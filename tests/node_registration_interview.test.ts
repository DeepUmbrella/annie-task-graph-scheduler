import test from "node:test";
import assert from "node:assert/strict";
import { createNodeRegistrationInterviewRequest } from "../src/node_registration_interview/index.js";
import type { CandidateNode } from "../src/runtime_discovery/index.js";

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
