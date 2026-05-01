import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { TaskGraphSchedulerError } from "../src/errors.js";
import { createPlanProposalStore, parsePlanProposalPayload } from "../src/plan_proposal/index.js";
import { bootstrapWorkflowFromProposal, createWorkflowIdFromProposal } from "../src/workflow_bootstrap/index.js";

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

async function seedProposal(rootDir: string) {
  const store = createPlanProposalStore(rootDir);
  const payload = parsePlanProposalPayload({
    intent_id: "intent_001",
    from: "develop-team",
    plan: validPlan()
  });

  return store.saveProposal(payload, {
    now: "2026-05-01T00:00:00.000Z"
  });
}

test("createWorkflowIdFromProposal creates a stable workflow id", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "annie-workflow-bootstrap-"));
  const proposal = await seedProposal(rootDir);

  assert.equal(createWorkflowIdFromProposal(proposal), "wf_intent_001_plan_site");
});

test("bootstrapWorkflowFromProposal creates workflow state and audit event", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "annie-workflow-bootstrap-"));
  const proposal = await seedProposal(rootDir);

  const result = await bootstrapWorkflowFromProposal({
    proposal_id: proposal.proposal_id,
    workflow_id: "wf_site"
  }, {
    rootDir,
    now: "2026-05-01T01:00:00.000Z"
  });

  assert.equal(result.workflow_id, "wf_site");
  assert.equal(result.state.workflow_id, "wf_site");
  assert.equal(result.state.plan_id, "plan_site");
  assert.equal(result.state.status, "pending");
  assert.equal(result.state.waves.length, 0);

  const state = JSON.parse(await readFile(result.state_path, "utf8")) as { workflow_id: string };
  assert.equal(state.workflow_id, "wf_site");

  const audit = await readFile(result.audit_path, "utf8");
  assert.match(audit, /WORKFLOW_BOOTSTRAPPED/);
  assert.match(audit, new RegExp(proposal.proposal_id));
});

test("bootstrapWorkflowFromProposal rejects missing proposals", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "annie-workflow-bootstrap-"));

  await assert.rejects(
    () => bootstrapWorkflowFromProposal({
      proposal_id: "missing-proposal"
    }, {
      rootDir
    }),
    (error) => error instanceof TaskGraphSchedulerError
      && error.code === "PLAN_PROPOSAL_NOT_FOUND"
  );
});
