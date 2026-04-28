import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { createStateStore } from "../src/storage/state_store.js";
import { createInitialWorkflowState, loadPlan } from "../src/validation/plan_loader.js";

const execFileAsync = promisify(execFile);
const cliPath = join(process.cwd(), "dist", "src", "cli.js");

async function runCli(args: string[]): Promise<unknown> {
  const result = await execFileAsync(process.execPath, [cliPath, ...args]);
  return JSON.parse(result.stdout) as unknown;
}

test("plan validate outputs handoff summary for a valid DAG", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "annie-tgs-handoff-plan-"));
  const planPath = join(rootDir, "plan.json");
  await writeFile(planPath, JSON.stringify({
    plan_id: "plan_handoff",
    plan_type: "dag",
    execution_policy: {
      max_parallel_tasks: 2,
      max_agents: 2,
      scheduling: {
        selection_order: "risk_aware"
      },
      conflicts: {
        mode: "directory"
      },
      retry: {
        max_retries: 2
      }
    },
    tasks: [
      {
        id: "T1",
        title: "Design contract",
        required_capabilities: ["architecture"],
        preferred_agent: "backend-agent",
        expected_files: ["docs/contract.md"],
        risk: "medium"
      },
      {
        id: "T2",
        title: "Implement handoff",
        depends_on: ["T1"],
        required_capabilities: ["backend"],
        preferred_agent: "backend-agent",
        expected_files: ["src/cli.ts"],
        risk: "high"
      }
    ]
  }), "utf8");

  const output = await runCli(["plan", "validate", "--plan", planPath]) as {
    valid: boolean;
    path: string;
    plan_id: string;
    task_count: number;
    topological_order: string[];
    dependency_edge_count: number;
    dependency_edges: Array<{ from: string; to: string }>;
    risks: Record<string, number>;
    required_capabilities: string[];
    preferred_agents: string[];
    expected_files_count: number;
    execution_policy: {
      max_parallel_tasks: number;
      max_agents: number;
      selection_order: string;
      conflict_mode: string;
      max_retries: number;
    };
  };

  assert.equal(output.valid, true);
  assert.equal(output.path, planPath);
  assert.equal(output.plan_id, "plan_handoff");
  assert.equal(output.task_count, 2);
  assert.deepEqual(output.topological_order, ["T1", "T2"]);
  assert.equal(output.dependency_edge_count, 1);
  assert.deepEqual(output.dependency_edges, [{ from: "T1", to: "T2" }]);
  assert.deepEqual(output.risks, { medium: 1, high: 1 });
  assert.deepEqual(output.required_capabilities, ["architecture", "backend"]);
  assert.deepEqual(output.preferred_agents, ["backend-agent"]);
  assert.equal(output.expected_files_count, 2);
  assert.equal(output.execution_policy.max_parallel_tasks, 2);
  assert.equal(output.execution_policy.max_agents, 2);
  assert.equal(output.execution_policy.selection_order, "risk_aware");
  assert.equal(output.execution_policy.conflict_mode, "directory");
  assert.equal(output.execution_policy.max_retries, 2);
});

test("plan validate supports structured JSON errors", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "annie-tgs-handoff-invalid-"));
  const planPath = join(rootDir, "invalid-plan.json");
  await writeFile(planPath, JSON.stringify({
    plan_id: "plan_invalid_handoff",
    plan_type: "linear",
    execution_policy: {},
    tasks: []
  }), "utf8");

  await assert.rejects(
    () => execFileAsync(process.execPath, [
      cliPath,
      "plan",
      "validate",
      "--plan",
      planPath,
      "--json-errors"
    ]),
    (error) => {
      const parsed = JSON.parse((error as { stderr?: string }).stderr ?? "{}") as {
        error?: { code?: string; details?: { errors?: string[] } };
      };
      assert.equal(parsed.error?.code, "PLAN_VALIDATION_FAILED");
      assert.equal(parsed.error?.details?.errors?.includes('plan_type must be "dag".'), true);
      assert.equal(parsed.error?.details?.errors?.includes("tasks must not be empty."), true);
      return true;
    }
  );
});

test("report outputs workflow execution handoff report", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "annie-tgs-handoff-report-"));
  const store = createStateStore(rootDir);
  const state = createInitialWorkflowState("wf_handoff_report", loadPlan({
    plan_id: "plan_handoff_report",
    plan_type: "dag",
    execution_policy: {},
    tasks: [
      {
        id: "T1",
        title: "Complete report"
      },
      {
        id: "T2",
        title: "Blocked delivery",
        depends_on: ["T1"]
      }
    ]
  }), "2026-04-28T00:00:00.000Z");
  state.status = "blocked";
  state.updated_at = "2026-04-28T00:20:00.000Z";
  state.tasks.T1!.status = "failed";
  state.tasks.T1!.failure_type = "implementation";
  state.tasks.T1!.failure_reason = "Report failed.";
  state.tasks.T2!.status = "blocked";
  state.tasks.T2!.blocked_reason = "Blocked by dependency T1.";
  state.waves.push({
    id: "wave_001",
    tasks: ["T1"],
    status: "failed",
    started_at: "2026-04-28T00:01:00.000Z",
    completed_at: "2026-04-28T00:02:00.000Z",
    review: {
      status: "failed",
      completed_tasks: [],
      failed_tasks: ["T1"],
      conflicts: [],
      allow_next_wave: false
    },
    reason: "Report wave",
    skipped_ready_tasks: []
  });
  await store.saveState(state);

  const output = await runCli(["report", "--root", rootDir, "--workflow", "wf_handoff_report"]) as {
    workflow_id: string;
    plan_id: string;
    status: string;
    task_summary: { total: number; failed: number; blocked: number };
    wave_summary: { reviews: Array<{ wave_id: string; status: string; allow_next_wave: boolean }> };
    failures: Array<{ task_id: string; status: string }>;
    handoff: { source: string; target: string; state_updated_at: string };
  };

  assert.equal(output.workflow_id, "wf_handoff_report");
  assert.equal(output.plan_id, "plan_handoff_report");
  assert.equal(output.status, "blocked");
  assert.equal(output.task_summary.total, 2);
  assert.equal(output.task_summary.failed, 1);
  assert.equal(output.task_summary.blocked, 1);
  assert.deepEqual(output.wave_summary.reviews, [{
    wave_id: "wave_001",
    status: "failed",
    allow_next_wave: false,
    completed_tasks: [],
    failed_tasks: ["T1"],
    conflicts: []
  }]);
  assert.deepEqual(output.failures.map((failure) => `${failure.task_id}:${failure.status}`), [
    "T1:failed",
    "T2:blocked"
  ]);
  assert.equal(output.handoff.source, "TaskGraphScheduler");
  assert.equal(output.handoff.target, "ExecutionWorkflow");
  assert.equal(output.handoff.state_updated_at, "2026-04-28T00:20:00.000Z");
});
