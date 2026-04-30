import test from "node:test";
import assert from "node:assert/strict";
import {
  assertAgentActionAllowed,
  createDefaultAgentActionPolicy,
  createSendMessagePermission,
  type AgentActionPolicy
} from "../src/agent_action/index.js";
import { TaskGraphSchedulerError } from "../src/errors.js";

test("default agent action policy allows runtime-agnostic local nodes", () => {
  const policy = createDefaultAgentActionPolicy();

  assertAgentActionAllowed(policy, {
    node_id: "local-review-node",
    action: "send_message",
    message_type: "REQUIREMENT_CLARIFICATION_REQUEST"
  });
});

test("createSendMessagePermission exposes shared message type permissions", () => {
  const permission = createSendMessagePermission();

  assert.equal(permission.action, "send_message");
  assert.ok(permission.message_types.includes("REQUIREMENT_CLARIFICATION_REQUEST"));
  assert.ok(permission.message_types.includes("HELP_REQUESTED"));
});

test("agent action policy rejects unknown nodes", () => {
  assert.throws(
    () => assertAgentActionAllowed(createDefaultAgentActionPolicy(), {
      node_id: "missing-node",
      action: "send_message",
      message_type: "REQUIREMENT_CLARIFICATION_REQUEST"
    }),
    (error) => error instanceof TaskGraphSchedulerError
      && error.code === "AGENT_ACTION_NODE_NOT_FOUND"
  );
});

test("agent action policy rejects disallowed actions", () => {
  const policy: AgentActionPolicy = {
    policy_id: "test-policy",
    source: "configured",
    nodes: [
      {
        node_id: "node-a",
        permissions: []
      }
    ]
  };

  assert.throws(
    () => assertAgentActionAllowed(policy, {
      node_id: "node-a",
      action: "send_message",
      message_type: "REQUIREMENT_CLARIFICATION_REQUEST"
    }),
    (error) => error instanceof TaskGraphSchedulerError
      && error.code === "AGENT_ACTION_NOT_ALLOWED"
  );
});

test("agent action policy rejects disallowed message types", () => {
  const policy: AgentActionPolicy = {
    policy_id: "test-policy",
    source: "configured",
    nodes: [
      {
        node_id: "node-a",
        permissions: [
          {
            action: "send_message",
            message_types: ["QUESTION_ASKED"]
          }
        ]
      }
    ]
  };

  assert.throws(
    () => assertAgentActionAllowed(policy, {
      node_id: "node-a",
      action: "send_message",
      message_type: "REQUIREMENT_CLARIFICATION_REQUEST"
    }),
    (error) => error instanceof TaskGraphSchedulerError
      && error.code === "AGENT_ACTION_MESSAGE_TYPE_NOT_ALLOWED"
  );
});
