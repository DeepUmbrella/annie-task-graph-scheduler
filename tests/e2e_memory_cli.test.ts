import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp } from "node:fs/promises";
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

async function createCompletedMemoryWorkflow(rootDir: string): Promise<void> {
  const store = createStateStore(rootDir);
  const state = createInitialWorkflowState("wf_memory_cli", loadPlan({
    plan_id: "plan_memory_cli",
    plan_type: "dag",
    execution_policy: {
      scheduling: {
        selection_order: "risk_aware",
        prefer_low_risk_first: true
      }
    },
    tasks: [
      {
        id: "T1",
        title: "Implement memory CLI",
        required_capabilities: ["backend"],
        preferred_agent: "backend-agent",
        risk: "medium"
      }
    ]
  }), "2026-04-27T00:00:00.000Z");

  state.tasks.T1!.status = "done";
  state.tasks.T1!.assigned_to = "backend-agent";
  state.tasks.T1!.result_summary = "Implemented memory CLI.";
  state.tasks.T1!.changed_files = ["src/cli.ts"];
  state.tasks.T1!.tests_run = ["npm test"];
  state.waves.push({
    id: "wave_001",
    tasks: ["T1"],
    status: "done",
    started_at: "2026-04-27T00:01:00.000Z",
    completed_at: "2026-04-27T00:02:00.000Z",
    review: {
      status: "passed",
      completed_tasks: ["T1"],
      failed_tasks: [],
      conflicts: [],
      allow_next_wave: true
    },
    reason: "Memory CLI wave",
    skipped_ready_tasks: []
  });

  await store.saveState(state);
}

test("memory extract outputs candidates from workflow state", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "annie-tgs-cli-memory-extract-"));
  await createCompletedMemoryWorkflow(rootDir);

  const output = await runCli(["memory", "extract", "--root", rootDir, "--workflow", "wf_memory_cli"]) as {
    workflow_id: string;
    candidate_count: number;
    candidates: Array<{ category: string }>;
  };

  assert.equal(output.workflow_id, "wf_memory_cli");
  assert.equal(output.candidate_count, 5);
  assert.deepEqual(output.candidates.map((candidate) => candidate.category).sort(), [
    "execution_result",
    "preference",
    "preference",
    "preference",
    "template_pattern"
  ]);
});

test("memory write stores records and memory list filters by category", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "annie-tgs-cli-memory-write-"));
  await createCompletedMemoryWorkflow(rootDir);

  const writeOutput = await runCli(["memory", "write", "--root", rootDir, "--workflow", "wf_memory_cli"]) as {
    candidate_count: number;
    record_count: number;
    records_path: string;
  };
  assert.equal(writeOutput.candidate_count, 5);
  assert.equal(writeOutput.record_count, 5);
  assert.equal(writeOutput.records_path, join(rootDir, "memory", "records.jsonl"));

  const allRecords = await runCli(["memory", "list", "--root", rootDir]) as Array<{ category: string }>;
  assert.equal(allRecords.length, 5);

  const preferenceRecords = await runCli([
    "memory",
    "list",
    "--root",
    rootDir,
    "--category",
    "preference"
  ]) as Array<{ category: string }>;
  assert.equal(preferenceRecords.length, 3);
  assert.equal(preferenceRecords.every((record) => record.category === "preference"), true);
});

test("memory list returns structured category errors", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "annie-tgs-cli-memory-error-"));

  await assert.rejects(
    () => execFileAsync(process.execPath, [
      cliPath,
      "memory",
      "list",
      "--root",
      rootDir,
      "--category",
      "missing"
    ]),
    (error) => {
      const stderr = (error as { stderr?: string }).stderr ?? "";
      return stderr.includes("MEMORY_CATEGORY_INVALID")
        && stderr.includes("\"allowed\"")
        && stderr.includes("template_pattern");
    }
  );
});
