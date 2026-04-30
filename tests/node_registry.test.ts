import test from "node:test";
import assert from "node:assert/strict";
import { normalizeNodeRegistrationProposal } from "../src/node_registry/index.js";
import { TaskGraphSchedulerError } from "../src/errors.js";

test("normalizes individual node registration proposals", () => {
  const snapshot = normalizeNodeRegistrationProposal({
    schema_version: "node-registration.v1",
    nodes: [
      {
        node_id: "annie-dev",
        node_type: "individual",
        display_name: "Annie Dev",
        runtime: "openclaw",
        declared_capabilities: ["frontend", "backend"],
        requested_actions: ["send_message"]
      }
    ]
  }, "2026-05-01T00:00:00.000Z");

  assert.equal(snapshot.nodes.length, 1);
  assert.equal(snapshot.nodes[0]?.node_id, "annie-dev");
  assert.equal(snapshot.nodes[0]?.node_type, "individual");
  assert.deepEqual(snapshot.nodes[0]?.granted_actions, ["send_message"]);
});

test("normalizes single-member team registration proposals", () => {
  const snapshot = normalizeNodeRegistrationProposal({
    schema_version: "node-registration.v1",
    nodes: [
      {
        node_id: "develop-team",
        node_type: "team",
        display_name: "Develop Team",
        requested_actions: ["send_message"]
      },
      {
        node_id: "annie-dev",
        node_type: "individual",
        display_name: "Annie Dev",
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
            team_role: "lead_developer",
            declared_capabilities: ["frontend", "backend"]
          }
        ]
      }
    ]
  }, "2026-05-01T00:00:00.000Z");

  assert.equal(snapshot.nodes.find((node) => node.node_id === "develop-team")?.node_type, "team");
  assert.equal(snapshot.team_compositions.length, 1);
  assert.equal(snapshot.team_compositions[0]?.members.length, 1);
  assert.equal(snapshot.team_compositions[0]?.members[0]?.node_id, "annie-dev");
});

test("rejects team members that are not registered", () => {
  assert.throws(
    () => normalizeNodeRegistrationProposal({
      schema_version: "node-registration.v1",
      nodes: [
        {
          node_id: "develop-team",
          node_type: "team"
        }
      ],
      team_compositions: [
        {
          team_node_id: "develop-team",
          lead_node_id: "ghost-dev",
          members: [
            {
              node_id: "ghost-dev",
              team_role: "developer"
            }
          ]
        }
      ]
    }),
    (error) => error instanceof TaskGraphSchedulerError
      && error.code === "TEAM_MEMBER_NOT_REGISTERED"
  );
});

test("rejects team composition for individual node", () => {
  assert.throws(
    () => normalizeNodeRegistrationProposal({
      schema_version: "node-registration.v1",
      nodes: [
        {
          node_id: "solo-dev",
          node_type: "individual"
        }
      ],
      team_compositions: [
        {
          team_node_id: "solo-dev",
          lead_node_id: "solo-dev",
          members: [
            {
              node_id: "solo-dev",
              team_role: "lead"
            }
          ]
        }
      ]
    }),
    (error) => error instanceof TaskGraphSchedulerError
      && error.code === "TEAM_NODE_TYPE_INVALID"
  );
});
