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
