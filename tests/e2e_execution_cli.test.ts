import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { createNodeRegistry } from "../src/node_registry/index.js";

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

test("CLI can print structured JSON errors", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "annie-tgs-cli-json-error-"));

  await assert.rejects(
    () => execFileAsync(process.execPath, [
      cliPath,
      "status",
      "--root",
      rootDir,
      "--workflow",
      "wf_missing",
      "--json-errors"
    ]),
    (error) => {
      const parsed = JSON.parse((error as { stderr?: string }).stderr ?? "{}") as {
        error?: { code?: string; message?: string; details?: { workflow_id?: string } };
      };
      assert.equal(parsed.error?.code, "STATE_LOAD_FAILED");
      assert.equal(parsed.error?.message, "Failed to load workflow state.");
      assert.equal(parsed.error?.details?.workflow_id, "wf_missing");
      return true;
    }
  );
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

  const auditEvents = parseAuditEvents(await readFile(join(rootDir, "workflows", "wf_next_wave", "audit.jsonl"), "utf8"));
  const statusEvents = auditEvents.filter((event) => event.type === "TASK_STATUS_CHANGED");
  assert.deepEqual(statusEvents.map((event) => `${event.payload.task_id}:${event.payload.from}->${event.payload.to}`), [
    "T1:pending->ready",
    "T2:pending->ready"
  ]);
  assert.equal(statusEvents.every((event) => event.payload.source === "dependency_resolver"), true);
  assert.equal(auditEvents.some((event) => event.type === "WORKFLOW_WAVE_SCHEDULED"), true);
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

test("CLI workflow-dispatch sends assignment without starting task", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "annie-tgs-cli-workflow-dispatch-"));
  const planPath = join(rootDir, "plan.json");
  await writeFile(planPath, JSON.stringify({
    plan_id: "plan_cli_workflow_dispatch",
    plan_type: "dag",
    execution_policy: {},
    tasks: [
      {
        id: "T1",
        title: "Frontend task",
        required_capabilities: ["frontend"],
        preferred_agent: "frontend-agent"
      }
    ]
  }), "utf8");
  await createNodeRegistry(rootDir).registerProposal({
    schema_version: "node-registration.v1",
    nodes: [
      {
        node_id: "frontend-agent",
        node_type: "individual",
        declared_capabilities: ["frontend"],
        requested_actions: ["send_message"]
      }
    ]
  });

  await runCli(["init", "--root", rootDir, "--plan", planPath, "--workflow", "wf_workflow_dispatch"]);
  await runCli(["next-wave", "--root", rootDir, "--workflow", "wf_workflow_dispatch"]);
  const output = await runCli(["workflow-dispatch", "--root", rootDir, "--workflow", "wf_workflow_dispatch"]) as {
    decision: { status: string; dispatched_task_ids: string[] };
    assignments: Array<{ task_id: string; node_id: string }>;
  };

  assert.equal(output.decision.status, "dispatched");
  assert.deepEqual(output.decision.dispatched_task_ids, ["T1"]);
  assert.deepEqual(output.assignments.map((assignment) => assignment.node_id), ["frontend-agent"]);

  const state = JSON.parse(await readFile(join(rootDir, "workflows", "wf_workflow_dispatch", "state.json"), "utf8")) as {
    tasks: Record<string, { status: string; assigned_to: string | null; started_at: string | null }>;
  };
  assert.equal(state.tasks.T1?.status, "assigned");
  assert.equal(state.tasks.T1?.assigned_to, "frontend-agent");
  assert.equal(state.tasks.T1?.started_at, null);

  const inboxRaw = await readFile(join(rootDir, "workflows", "wf_workflow_dispatch", "mailboxes", "frontend-agent", "inbox.jsonl"), "utf8");
  const inbox = inboxRaw
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as { type: string; from: string; to: string });
  assert.equal(inbox.length, 1);
  assert.equal(inbox[0]?.type, "TASK_ASSIGNED");
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

test("CLI review-wave runs ReviewGate and marks reviewing tasks done", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "annie-tgs-cli-review-wave-"));
  const planPath = join(rootDir, "plan.json");
  const resultPath = join(rootDir, "result.json");
  await writeFile(planPath, JSON.stringify({
    plan_id: "plan_cli_review_wave",
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
    changed_files: ["src/backend.ts"]
  }), "utf8");

  await runCli(["init", "--root", rootDir, "--plan", planPath, "--workflow", "wf_review"]);
  await runCli(["next-wave", "--root", rootDir, "--workflow", "wf_review"]);
  await runCli(["dispatch", "--root", rootDir, "--workflow", "wf_review", "--wave", "wave_001"]);
  await runCli(["submit-result", "--root", rootDir, "--workflow", "wf_review", "--result", resultPath]);
  const output = await runCli([
    "review-wave",
    "--root",
    rootDir,
    "--workflow",
    "wf_review",
    "--wave",
    "wave_001"
  ]) as {
    review: { status: string; allow_next_wave: boolean; completed_tasks: string[] };
    audit_events: number;
    state: { status: string; current_wave: string | null; wave_status: string };
  };

  assert.equal(output.review.status, "passed");
  assert.equal(output.review.allow_next_wave, true);
  assert.deepEqual(output.review.completed_tasks, ["T1"]);
  assert.equal(output.audit_events, 2);
  assert.deepEqual(output.state, {
    status: "running",
    current_wave: null,
    wave_status: "done"
  });

  const state = JSON.parse(await readFile(join(rootDir, "workflows", "wf_review", "state.json"), "utf8")) as {
    tasks: Record<string, { status: string }>;
    waves: Array<{ id: string; status: string; review: { status: string } }>;
  };
  assert.equal(state.tasks.T1?.status, "done");
  assert.equal(state.waves[0]?.status, "done");
  assert.equal(state.waves[0]?.review.status, "passed");

  const audit = await readFile(join(rootDir, "workflows", "wf_review", "audit.jsonl"), "utf8");
  assert.match(audit, /WAVE_REVIEWED/);
});

test("Execution CLI runs a successful workflow into the next wave", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "annie-tgs-cli-full-success-"));
  const planPath = join(rootDir, "plan.json");
  const resultT1Path = join(rootDir, "result-t1.json");
  await writeFile(planPath, JSON.stringify({
    plan_id: "plan_cli_full_success",
    plan_type: "dag",
    execution_policy: {},
    tasks: [
      {
        id: "T1",
        title: "Design",
        preferred_agent: "design-agent"
      },
      {
        id: "T2",
        title: "Implement",
        depends_on: ["T1"],
        preferred_agent: "backend-agent"
      }
    ]
  }), "utf8");
  await writeFile(resultT1Path, JSON.stringify({
    task_id: "T1",
    status: "completed",
    summary: "Design complete.",
    changed_files: ["docs/design.md"]
  }), "utf8");

  await runCli(["init", "--root", rootDir, "--plan", planPath, "--workflow", "wf_full_success"]);
  const firstWave = await runCli(["next-wave", "--root", rootDir, "--workflow", "wf_full_success"]) as {
    wave: { id: string; tasks: string[] };
  };
  assert.deepEqual(firstWave.wave.tasks, ["T1"]);

  await runCli(["dispatch", "--root", rootDir, "--workflow", "wf_full_success", "--wave", "wave_001"]);
  await runCli(["submit-result", "--root", rootDir, "--workflow", "wf_full_success", "--result", resultT1Path]);
  await runCli(["review-wave", "--root", rootDir, "--workflow", "wf_full_success", "--wave", "wave_001"]);
  const secondWave = await runCli(["next-wave", "--root", rootDir, "--workflow", "wf_full_success"]) as {
    ready_task_ids: string[];
    status_changes: Array<{ task_id: string; from: string; to: string }>;
    wave: { id: string; tasks: string[] };
  };

  assert.deepEqual(secondWave.ready_task_ids, ["T2"]);
  assert.deepEqual(secondWave.status_changes.map((change) => `${change.task_id}:${change.from}->${change.to}`), [
    "T2:pending->ready"
  ]);
  assert.equal(secondWave.wave.id, "wave_002");
  assert.deepEqual(secondWave.wave.tasks, ["T2"]);

  const state = JSON.parse(await readFile(join(rootDir, "workflows", "wf_full_success", "state.json"), "utf8")) as {
    tasks: Record<string, { status: string }>;
    waves: Array<{ id: string; status: string; tasks: string[] }>;
  };
  assert.equal(state.tasks.T1?.status, "done");
  assert.equal(state.tasks.T2?.status, "ready");
  assert.deepEqual(state.waves.map((wave) => `${wave.id}:${wave.status}:${wave.tasks.join(",")}`), [
    "wave_001:done:T1",
    "wave_002:pending:T2"
  ]);
});

test("Execution CLI blocks downstream tasks after non-retryable failure", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "annie-tgs-cli-failure-blocks-"));
  const planPath = join(rootDir, "plan.json");
  const resultT1Path = join(rootDir, "result-t1-failed.json");
  await writeFile(planPath, JSON.stringify({
    plan_id: "plan_cli_failure_blocks",
    plan_type: "dag",
    execution_policy: {},
    tasks: [
      {
        id: "T1",
        title: "Risky root",
        preferred_agent: "backend-agent"
      },
      {
        id: "T2",
        title: "Downstream",
        depends_on: ["T1"],
        preferred_agent: "backend-agent"
      }
    ]
  }), "utf8");
  await writeFile(resultT1Path, JSON.stringify({
    task_id: "T1",
    status: "failed",
    summary: "Implementation failed.",
    failure_type: "implementation",
    failure_reason: "Compile error"
  }), "utf8");

  await runCli(["init", "--root", rootDir, "--plan", planPath, "--workflow", "wf_failure_blocks"]);
  await runCli(["next-wave", "--root", rootDir, "--workflow", "wf_failure_blocks"]);
  await runCli(["dispatch", "--root", rootDir, "--workflow", "wf_failure_blocks", "--wave", "wave_001"]);
  const failedResult = await runCli(["submit-result", "--root", rootDir, "--workflow", "wf_failure_blocks", "--result", resultT1Path]) as {
    status: string;
    retry_count: number;
  };
  assert.equal(failedResult.status, "failed");
  assert.equal(failedResult.retry_count, 0);

  const review = await runCli(["review-wave", "--root", rootDir, "--workflow", "wf_failure_blocks", "--wave", "wave_001"]) as {
    review: { status: string; allow_next_wave: boolean; failed_tasks: string[] };
  };
  assert.equal(review.review.status, "failed");
  assert.equal(review.review.allow_next_wave, false);
  assert.deepEqual(review.review.failed_tasks, ["T1"]);

  const nextWave = await runCli(["next-wave", "--root", rootDir, "--workflow", "wf_failure_blocks"]) as {
    blocked_task_ids: string[];
    wave: null;
  };
  assert.deepEqual(nextWave.blocked_task_ids, ["T2"]);
  assert.equal(nextWave.wave, null);

  const state = JSON.parse(await readFile(join(rootDir, "workflows", "wf_failure_blocks", "state.json"), "utf8")) as {
    tasks: Record<string, { status: string; blocked_reason?: string }>;
  };
  assert.equal(state.tasks.T1?.status, "failed");
  assert.equal(state.tasks.T2?.status, "blocked");
  assert.equal(state.tasks.T2?.blocked_reason, "Blocked by dependency T1.");

  const auditEvents = parseAuditEvents(await readFile(join(rootDir, "workflows", "wf_failure_blocks", "audit.jsonl"), "utf8"));
  assert.equal(auditEvents.some((event) =>
    event.payload.task_id === "T2"
      && event.payload.from === "pending"
      && event.payload.to === "blocked"
      && event.payload.reason === "Dependency T1 is failed."
      && event.payload.source === "dependency_resolver"
  ), true);
});

function parseAuditEvents(raw: string): Array<{ type: string; payload: Record<string, unknown> }> {
  return raw
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as { type: string; payload: Record<string, unknown> });
}
