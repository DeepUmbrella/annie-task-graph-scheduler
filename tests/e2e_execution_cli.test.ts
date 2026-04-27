import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const cliPath = join(process.cwd(), "dist", "src", "cli.js");

async function runCli(args: string[]): Promise<unknown> {
  const result = await execFileAsync(process.execPath, [cliPath, ...args]);
  return JSON.parse(result.stdout) as unknown;
}

test("CLI init creates workflow state from a plan file", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "annie-tgs-cli-init-"));
  const planPath = join(rootDir, "plan.json");
  await writeFile(planPath, JSON.stringify({
    plan_id: "plan_cli_init",
    plan_type: "dag",
    execution_policy: {},
    tasks: [
      {
        id: "T1",
        title: "Root task"
      }
    ]
  }), "utf8");

  const output = await runCli(["init", "--root", rootDir, "--plan", planPath]) as {
    workflow_id: string;
    plan_id: string;
    status: string;
    task_count: number;
    state_path: string;
  };

  assert.equal(output.workflow_id, "wf_plan_cli_init");
  assert.equal(output.plan_id, "plan_cli_init");
  assert.equal(output.status, "pending");
  assert.equal(output.task_count, 1);
  assert.equal(output.state_path, join(rootDir, "workflows", "wf_plan_cli_init", "state.json"));

  const state = JSON.parse(await readFile(output.state_path, "utf8")) as {
    workflow_id: string;
    plan_id: string;
    tasks: Record<string, { status: string }>;
  };
  assert.equal(state.workflow_id, "wf_plan_cli_init");
  assert.equal(state.plan_id, "plan_cli_init");
  assert.equal(state.tasks.T1?.status, "pending");
});

test("CLI init accepts explicit workflow id", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "annie-tgs-cli-init-explicit-"));
  const planPath = join(rootDir, "plan.json");
  await writeFile(planPath, JSON.stringify({
    plan_id: "plan_custom_workflow",
    plan_type: "dag",
    execution_policy: {},
    tasks: [
      {
        id: "T1",
        title: "Root task"
      }
    ]
  }), "utf8");

  const output = await runCli([
    "init",
    "--root",
    rootDir,
    "--plan",
    planPath,
    "--workflow",
    "wf_custom"
  ]) as { workflow_id: string; state_path: string };

  assert.equal(output.workflow_id, "wf_custom");
  assert.equal(output.state_path, join(rootDir, "workflows", "wf_custom", "state.json"));
});

test("CLI next-wave resolves dependencies and persists generated wave", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "annie-tgs-cli-next-wave-"));
  const planPath = join(rootDir, "plan.json");
  await writeFile(planPath, JSON.stringify({
    plan_id: "plan_cli_next_wave",
    plan_type: "dag",
    execution_policy: {
      max_parallel_tasks: 3
    },
    tasks: [
      {
        id: "T1",
        title: "Root",
        expected_files: ["src/root.ts"]
      },
      {
        id: "T2",
        title: "Conflicting peer",
        expected_files: ["src/root.ts"]
      },
      {
        id: "T3",
        title: "Downstream",
        depends_on: ["T1"]
      }
    ]
  }), "utf8");

  await runCli(["init", "--root", rootDir, "--plan", planPath, "--workflow", "wf_next_wave"]);
  const output = await runCli(["next-wave", "--root", rootDir, "--workflow", "wf_next_wave"]) as {
    ready_task_ids: string[];
    status_changes: Array<{ task_id: string; from: string; to: string }>;
    wave: { id: string; tasks: string[] };
    skipped_ready_tasks: Array<{ task_id: string; reason: string }>;
  };

  assert.deepEqual(output.ready_task_ids, ["T1", "T2"]);
  assert.deepEqual(output.status_changes.map((change) => `${change.task_id}:${change.from}->${change.to}`), [
    "T1:pending->ready",
    "T2:pending->ready"
  ]);
  assert.equal(output.wave.id, "wave_001");
  assert.deepEqual(output.wave.tasks, ["T1"]);
  assert.equal(output.skipped_ready_tasks[0]?.task_id, "T2");
  assert.match(output.skipped_ready_tasks[0]?.reason ?? "", /file conflict/);

  const state = JSON.parse(await readFile(join(rootDir, "workflows", "wf_next_wave", "state.json"), "utf8")) as {
    tasks: Record<string, { status: string }>;
    waves: Array<{ id: string; tasks: string[] }>;
  };
  assert.equal(state.tasks.T1?.status, "ready");
  assert.equal(state.tasks.T2?.status, "ready");
  assert.equal(state.tasks.T3?.status, "pending");
  assert.deepEqual(state.waves.map((wave) => wave.id), ["wave_001"]);
});

test("CLI dispatch assigns wave tasks and writes audit events", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "annie-tgs-cli-dispatch-"));
  const planPath = join(rootDir, "plan.json");
  await writeFile(planPath, JSON.stringify({
    plan_id: "plan_cli_dispatch",
    plan_type: "dag",
    execution_policy: {},
    tasks: [
      {
        id: "T1",
        title: "Backend",
        preferred_agent: "backend-agent"
      }
    ]
  }), "utf8");

  await runCli(["init", "--root", rootDir, "--plan", planPath, "--workflow", "wf_dispatch"]);
  await runCli(["next-wave", "--root", rootDir, "--workflow", "wf_dispatch"]);
  const output = await runCli([
    "dispatch",
    "--root",
    rootDir,
    "--workflow",
    "wf_dispatch",
    "--wave",
    "wave_001"
  ]) as {
    assignments: Array<{ task_id: string; assigned_to: string; decision: string }>;
    audit_events: number;
    state: { status: string; current_wave: string; wave_status: string };
  };

  assert.deepEqual(output.assignments, [
    {
      task_id: "T1",
      assigned_to: "backend-agent",
      decision: "preferred_agent_available"
    }
  ]);
  assert.equal(output.audit_events, 2);
  assert.deepEqual(output.state, {
    status: "running",
    current_wave: "wave_001",
    wave_status: "running"
  });

  const state = JSON.parse(await readFile(join(rootDir, "workflows", "wf_dispatch", "state.json"), "utf8")) as {
    tasks: Record<string, { status: string; assigned_to: string | null }>;
    waves: Array<{ id: string; status: string }>;
  };
  assert.equal(state.tasks.T1?.status, "running");
  assert.equal(state.tasks.T1?.assigned_to, "backend-agent");
  assert.equal(state.waves[0]?.status, "running");

  const audit = await readFile(join(rootDir, "workflows", "wf_dispatch", "audit.jsonl"), "utf8");
  assert.match(audit, /WORKER_ASSIGNED/);
  assert.match(audit, /TASK_STATUS_CHANGED/);
});

test("CLI submit-result collects worker output and persists task result", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "annie-tgs-cli-submit-result-"));
  const planPath = join(rootDir, "plan.json");
  const resultPath = join(rootDir, "result.json");
  await writeFile(planPath, JSON.stringify({
    plan_id: "plan_cli_submit_result",
    plan_type: "dag",
    execution_policy: {},
    tasks: [
      {
        id: "T1",
        title: "Backend",
        preferred_agent: "backend-agent"
      }
    ]
  }), "utf8");
  await writeFile(resultPath, JSON.stringify({
    task_id: "T1",
    status: "completed",
    summary: "Implemented backend.",
    changed_files: ["src/backend.ts"],
    tests_run: ["npm test"],
    risks: []
  }), "utf8");

  await runCli(["init", "--root", rootDir, "--plan", planPath, "--workflow", "wf_submit"]);
  await runCli(["next-wave", "--root", rootDir, "--workflow", "wf_submit"]);
  await runCli(["dispatch", "--root", rootDir, "--workflow", "wf_submit", "--wave", "wave_001"]);
  const output = await runCli([
    "submit-result",
    "--root",
    rootDir,
    "--workflow",
    "wf_submit",
    "--result",
    resultPath
  ]) as {
    task_id: string;
    status: string;
    assigned_to: string;
    changed_files: string[];
    tests_run: string[];
    audit_events: number;
  };

  assert.equal(output.task_id, "T1");
  assert.equal(output.status, "reviewing");
  assert.equal(output.assigned_to, "backend-agent");
  assert.deepEqual(output.changed_files, ["src/backend.ts"]);
  assert.deepEqual(output.tests_run, ["npm test"]);
  assert.equal(output.audit_events, 2);

  const state = JSON.parse(await readFile(join(rootDir, "workflows", "wf_submit", "state.json"), "utf8")) as {
    tasks: Record<string, { status: string; changed_files: string[]; tests_run: string[]; result_summary: string }>;
    agents: Record<string, { active_task_ids: string[]; status: string }>;
  };
  assert.equal(state.tasks.T1?.status, "reviewing");
  assert.deepEqual(state.tasks.T1?.changed_files, ["src/backend.ts"]);
  assert.deepEqual(state.tasks.T1?.tests_run, ["npm test"]);
  assert.equal(state.tasks.T1?.result_summary, "Implemented backend.");
  assert.deepEqual(state.agents["backend-agent"]?.active_task_ids, []);
  assert.equal(state.agents["backend-agent"]?.status, "idle");

  const audit = await readFile(join(rootDir, "workflows", "wf_submit", "audit.jsonl"), "utf8");
  assert.match(audit, /TASK_RESULT_COLLECTED/);
});
