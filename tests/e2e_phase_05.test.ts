import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createProjectRegistry, createStateStore } from "../src/index.js";
import { createInitialWorkflowState, loadPlan } from "../src/validation/plan_loader.js";

const execFileAsync = promisify(execFile);
const cliPath = join(process.cwd(), "dist", "src", "cli.js");

async function runCli(args: string[]): Promise<unknown> {
  const result = await execFileAsync(process.execPath, [cliPath, ...args]);
  return JSON.parse(result.stdout) as unknown;
}

test("Phase 05 CLI registers lists and shows projects", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "annie-tgs-cli-project-"));

  const registered = await runCli([
    "project",
    "register",
    "--root",
    rootDir,
    "--project",
    "project_cli",
    "--name",
    "CLI Project",
    "--root-path",
    "/workspace/cli",
    "--priority",
    "high",
    "--tag",
    "cli"
  ]) as { project_id: string; priority: string; tags: string[] };

  assert.equal(registered.project_id, "project_cli");
  assert.equal(registered.priority, "high");
  assert.deepEqual(registered.tags, ["cli"]);

  const listed = await runCli(["project", "list", "--root", rootDir]) as Array<{ project_id: string }>;
  assert.deepEqual(listed.map((project) => project.project_id), ["project_cli"]);

  const shown = await runCli(["project", "show", "--root", rootDir, "--project", "project_cli"]) as {
    project: { project_id: string };
    workflows: unknown[];
  };
  assert.equal(shown.project.project_id, "project_cli");
  assert.deepEqual(shown.workflows, []);
});

test("Phase 05 CLI builds queue and dispatch plan from registered workflow state", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "annie-tgs-cli-queue-"));
  const registry = createProjectRegistry(rootDir);
  const store = createStateStore(rootDir);
  const project = await registry.registerProject({
    project_id: "project_queue",
    name: "Queue Project",
    root_path: "/workspace/queue",
    priority: "urgent"
  }, {
    now: "2026-04-27T00:00:00.000Z"
  });

  const state = createInitialWorkflowState("wf_queue", loadPlan({
    plan_id: "plan_queue",
    plan_type: "dag",
    execution_policy: {},
    tasks: [
      {
        id: "T_ready",
        title: "Ready task",
        required_capabilities: ["backend"],
        preferred_agent: "backend-agent"
      }
    ]
  }), "2026-04-27T00:00:00.000Z");
  state.tasks.T_ready!.status = "ready";
  state.agents["backend-agent"] = {
    agent_id: "backend-agent",
    capabilities: ["backend"],
    active_task_ids: [],
    max_concurrent_tasks: 1,
    session_id: "session_backend",
    status: "idle"
  };
  await store.saveState(state);
  await registry.registerWorkflow({
    project_id: project.project_id,
    workflow_id: state.workflow_id,
    plan_id: state.plan_id,
    state_path: store.statePath(state.workflow_id),
    priority: "focus"
  }, {
    now: "2026-04-27T00:01:00.000Z"
  });

  const queue = await runCli(["queue", "build", "--root", rootDir]) as {
    items: Array<{ id: string; project_priority: string; user_priority: string }>;
  };
  assert.deepEqual(queue.items.map((item) => item.id), ["project_queue:wf_queue:T_ready"]);
  assert.equal(queue.items[0]?.project_priority, "urgent");
  assert.equal(queue.items[0]?.user_priority, "focus");

  const plan = await runCli(["queue", "plan", "--root", rootDir]) as {
    dispatch_plan: { assignments: Array<{ global_task_id: string; assigned_to: string }> };
  };
  assert.deepEqual(plan.dispatch_plan.assignments, [
    {
      global_task_id: "project_queue:wf_queue:T_ready",
      assigned_to: "backend-agent",
      decision: "preferred_agent_available",
      priority_score: 340,
      risk_score: 15,
      project_id: "project_queue",
      workflow_id: "wf_queue",
      task_id: "T_ready"
    }
  ]);
});
