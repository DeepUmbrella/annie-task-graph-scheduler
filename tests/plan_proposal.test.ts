import test from "node:test";
import assert from "node:assert/strict";
import { parsePlanProposalPayload } from "../src/plan_proposal/index.js";
import { TaskGraphSchedulerError } from "../src/errors.js";

function validPlan() {
  return {
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
  };
}

test("parsePlanProposalPayload accepts object plans", () => {
  const parsed = parsePlanProposalPayload({
    intent_id: "intent_001",
    from: "develop-team",
    plan: validPlan()
  });

  assert.equal(parsed.intent_id, "intent_001");
  assert.equal(parsed.from, "develop-team");
  assert.equal(parsed.plan.plan_id, "plan_site");
});

test("parsePlanProposalPayload accepts fenced json plans", () => {
  const parsed = parsePlanProposalPayload({
    intent_id: "intent_001",
    from: "develop-team",
    content: `Here is the plan:\n\`\`\`json\n${JSON.stringify(validPlan())}\n\`\`\``
  });

  assert.equal(parsed.plan.plan_id, "plan_site");
});

test("parsePlanProposalPayload rejects invalid json", () => {
  assert.throws(
    () => parsePlanProposalPayload({
      intent_id: "intent_001",
      from: "develop-team",
      content: "```json\n{bad-json}\n```"
    }),
    (error) => error instanceof TaskGraphSchedulerError
      && error.code === "PLAN_PROPOSAL_JSON_INVALID"
  );
});

test("parsePlanProposalPayload rejects invalid DAG plans", () => {
  assert.throws(
    () => parsePlanProposalPayload({
      intent_id: "intent_001",
      from: "develop-team",
      plan: {
        ...validPlan(),
        tasks: []
      }
    }),
    (error) => error instanceof TaskGraphSchedulerError
      && error.code === "PLAN_VALIDATION_FAILED"
  );
});
