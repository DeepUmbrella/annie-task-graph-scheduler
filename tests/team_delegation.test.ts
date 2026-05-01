import test from "node:test";
import assert from "node:assert/strict";
import { createDelegateToMemberPermission, type AgentActionPolicy } from "../src/agent_action/index.js";
import { TaskGraphSchedulerError } from "../src/errors.js";
import { normalizeNodeRegistrationProposal } from "../src/node_registry/index.js";
import { validateTeamDelegation } from "../src/team_delegation/index.js";

function createSnapshot() {
  return normalizeNodeRegistrationProposal({
    schema_version: "node-registration.v1",
    nodes: [
      {
        node_id: "develop-team",
        node_type: "team"
      },
      {
        node_id: "annie-pm",
        node_type: "individual",
        granted_actions: ["delegate_to_member"]
      },
      {
        node_id: "annie-dev",
        node_type: "individual"
      },
      {
        node_id: "review-agent",
        node_type: "individual"
      }
    ],
    team_compositions: [
      {
        team_node_id: "develop-team",
        lead_node_id: "annie-pm",
        members: [
          {
            node_id: "annie-pm",
            team_role: "lead"
          },
          {
            node_id: "annie-dev",
            team_role: "developer"
          }
        ]
      }
    ]
  }, "2026-05-01T00:00:00.000Z");
}

function createPolicy(): AgentActionPolicy {
  return {
    policy_id: "test-policy",
    source: "configured",
    nodes: [
      {
        node_id: "annie-pm",
        permissions: [createDelegateToMemberPermission()]
      }
    ]
  };
}

test("validateTeamDelegation accepts same-team member delegation", () => {
  assert.doesNotThrow(() => validateTeamDelegation({
    snapshot: createSnapshot(),
    actionPolicy: createPolicy(),
    from: "annie-pm",
    to: "annie-dev",
    message_type: "TASK_ASSIGNED",
    team_context: {
      team_node_id: "develop-team",
      role: "lead"
    }
  }));
});

test("validateTeamDelegation rejects non-member senders", () => {
  assert.throws(
    () => validateTeamDelegation({
      snapshot: createSnapshot(),
      actionPolicy: createPolicy(),
      from: "review-agent",
      to: "annie-dev",
      message_type: "TASK_ASSIGNED",
      team_context: {
        team_node_id: "develop-team"
      }
    }),
    (error) => error instanceof TaskGraphSchedulerError
      && error.code === "TEAM_CONTEXT_NODE_NOT_MEMBER"
  );
});

test("validateTeamDelegation rejects targets outside the team", () => {
  assert.throws(
    () => validateTeamDelegation({
      snapshot: createSnapshot(),
      actionPolicy: createPolicy(),
      from: "annie-pm",
      to: "review-agent",
      message_type: "TASK_ASSIGNED",
      team_context: {
        team_node_id: "develop-team"
      }
    }),
    (error) => error instanceof TaskGraphSchedulerError
      && error.code === "TEAM_DELEGATION_TARGET_NOT_MEMBER"
  );
});

test("validateTeamDelegation rejects ungranted delegation actions", () => {
  const policy: AgentActionPolicy = {
    policy_id: "test-policy",
    source: "configured",
    nodes: [
      {
        node_id: "annie-pm",
        permissions: []
      }
    ]
  };

  assert.throws(
    () => validateTeamDelegation({
      snapshot: createSnapshot(),
      actionPolicy: policy,
      from: "annie-pm",
      to: "annie-dev",
      message_type: "TASK_ASSIGNED",
      team_context: {
        team_node_id: "develop-team"
      }
    }),
    (error) => error instanceof TaskGraphSchedulerError
      && error.code === "AGENT_ACTION_NOT_ALLOWED"
  );
});
