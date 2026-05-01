import type { CandidateNode } from "../runtime_discovery/index.js";

export interface NodeRegistrationInterviewRequest {
  schema_version: "node-registration-interview.v1";
  candidate_id: string;
  runtime: string;
  runtime_ref?: Record<string, unknown>;
  node_id_hint: string;
  node_type_hint: CandidateNode["node_type_hint"];
  required_response_schema: "node-registration.v1";
  requested_actions_note: string;
  prompt: string;
}

export function createNodeRegistrationInterviewRequest(candidate: CandidateNode): NodeRegistrationInterviewRequest {
  return {
    schema_version: "node-registration-interview.v1",
    candidate_id: candidate.candidate_id,
    runtime: candidate.runtime,
    runtime_ref: candidate.runtime_ref,
    node_id_hint: candidate.node_id_hint,
    node_type_hint: candidate.node_type_hint,
    required_response_schema: "node-registration.v1",
    requested_actions_note: "requested_actions are only requests; granted_actions are assigned by Annie approval policy.",
    prompt: buildRegistrationPrompt(candidate)
  };
}

function buildRegistrationPrompt(candidate: CandidateNode): string {
  return [
    "Respond with a single JSON object using schema_version node-registration.v1.",
    "Describe the node or team you represent using nodes[] and optional team_compositions[].",
    "Use requested_actions for actions you need, but do not set granted_actions unless Annie explicitly provided them.",
    "Do not include markdown or explanatory text outside the JSON object.",
    "",
    "Candidate context:",
    JSON.stringify({
      candidate_id: candidate.candidate_id,
      runtime: candidate.runtime,
      runtime_ref: candidate.runtime_ref,
      node_id_hint: candidate.node_id_hint,
      node_type_hint: candidate.node_type_hint,
      display_name: candidate.display_name,
      declared_capabilities: candidate.declared_capabilities,
      requested_actions: candidate.requested_actions
    }, null, 2)
  ].join("\n");
}
