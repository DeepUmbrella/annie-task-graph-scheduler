import test from "node:test";
import assert from "node:assert/strict";
import { access, mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createPlanProposalStore, parsePlanProposalPayload } from "../src/plan_proposal/index.js";
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

test("plan proposal store returns empty snapshot when file does not exist", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "annie-plan-proposal-"));
  const store = createPlanProposalStore(rootDir);

  const snapshot = await store.loadSnapshot();

  assert.equal(snapshot.version, 1);
  assert.equal(snapshot.proposals.length, 0);
  assert.equal(snapshot.updated_at, null);
});

test("plan proposal store saves and reads proposals", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "annie-plan-proposal-"));
  const store = createPlanProposalStore(rootDir);
  const payload = parsePlanProposalPayload({
    intent_id: "intent_001",
    from: "develop-team",
    plan: validPlan()
  });

  const proposal = await store.saveProposal(payload, {
    now: "2026-05-01T00:00:00.000Z"
  });
  const raw = await readFile(store.proposalsPath(), "utf8");
  const persisted = JSON.parse(raw);
  const proposals = await store.listProposals();

  assert.equal(proposal.proposal_id, "proposal_1777593600000_plan_site");
  assert.equal(persisted.proposals.length, 1);
  assert.equal(proposals[0]?.plan.plan_id, "plan_site");
  assert.equal(proposals[0]?.validation_status, "valid");
});

test("plan proposal store does not create workflow state", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "annie-plan-proposal-"));
  const store = createPlanProposalStore(rootDir);
  const payload = parsePlanProposalPayload({
    intent_id: "intent_001",
    from: "develop-team",
    plan: validPlan()
  });

  await store.saveProposal(payload, {
    now: "2026-05-01T00:00:00.000Z"
  });

  await assert.rejects(
    () => access(join(rootDir, "workflows", "intent_001", "state.json")),
    (error) => typeof error === "object"
      && error !== null
      && "code" in error
      && (error as { code?: string }).code === "ENOENT"
  );
});
