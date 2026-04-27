import test from "node:test";
import assert from "node:assert/strict";
import { extractExecutionMemoryCandidates, memoryCategories, memoryConfidenceLevels } from "../src/index.js";
import type { MemoryAdapter, MemoryCandidate, MemoryRecord } from "../src/index.js";
import { createInitialWorkflowState, loadPlan } from "../src/validation/plan_loader.js";

test("constructs memory candidate and record models", () => {
  const candidate: MemoryCandidate = {
    category: "execution_result",
    title: "Backend implementation completed",
    summary: "Task T1 completed with tests.",
    content: {
      changed_files: ["src/backend.ts"],
      tests_run: ["npm test"]
    },
    confidence: "high",
    reason: "Task is done and its wave passed review.",
    tags: ["execution", "backend"],
    provenance: {
      workflow_id: "wf_memory",
      plan_id: "plan_memory",
      wave_id: "wave_001",
      task_id: "T1",
      source: "workflow_state",
      source_key: "wf_memory:wave_001:T1:execution_result",
      created_at: "2026-04-27T00:00:00.000Z"
    }
  };

  const record: MemoryRecord = {
    ...candidate,
    id: "mem_wf_memory_wave_001_T1_execution_result",
    stored_at: "2026-04-27T00:01:00.000Z"
  };

  assert.equal(record.category, "execution_result");
  assert.equal(record.provenance.workflow_id, "wf_memory");
  assert.equal(record.provenance.wave_id, "wave_001");
  assert.equal(record.provenance.task_id, "T1");
  assert.deepEqual(record.content.changed_files, ["src/backend.ts"]);
});

test("memory adapter boundary does not require a remote service", async () => {
  const records: MemoryRecord[] = [];
  const adapter: MemoryAdapter = {
    async append(candidate, options = {}) {
      const record: MemoryRecord = {
        ...candidate,
        id: `mem_${records.length + 1}`,
        stored_at: options.now ?? "2026-04-27T00:00:00.000Z"
      };
      records.push(record);
      return record;
    },
    async list(filter = {}) {
      return records.filter((record) =>
        (!filter.category || record.category === filter.category)
        && (!filter.tag || record.tags.includes(filter.tag))
        && (!filter.workflow_id || record.provenance.workflow_id === filter.workflow_id)
      );
    },
    async findByCategory(category) {
      return records.filter((record) => record.category === category);
    }
  };

  await adapter.append({
    category: "preference",
    title: "Prefer low-risk first",
    summary: "Scheduler used risk-aware ordering.",
    content: {
      selection_order: "risk_aware"
    },
    confidence: "medium",
    reason: "Policy explicitly selected risk-aware ordering.",
    tags: ["policy"],
    provenance: {
      workflow_id: "wf_memory",
      plan_id: "plan_memory",
      wave_id: null,
      task_id: null,
      source: "scheduler_decision",
      source_key: "wf_memory:policy:risk_aware",
      created_at: "2026-04-27T00:00:00.000Z"
    }
  });

  assert.equal((await adapter.findByCategory("preference")).length, 1);
  assert.equal((await adapter.list({ tag: "policy" })).length, 1);
  assert.equal((await adapter.list({ workflow_id: "wf_memory" })).length, 1);
});

test("exports stable memory enum values", () => {
  assert.deepEqual(memoryCategories, ["execution_result", "preference", "template_pattern"]);
  assert.deepEqual(memoryConfidenceLevels, ["low", "medium", "high"]);
});

test("extractExecutionMemoryCandidates extracts done tasks from passed waves", () => {
  const state = createInitialWorkflowState("wf_memory_extract", loadPlan({
    plan_id: "plan_memory_extract",
    plan_type: "dag",
    execution_policy: {},
    tasks: [
      {
        id: "T_done",
        title: "Implemented backend",
        required_capabilities: ["backend"],
        risk: "medium"
      },
      {
        id: "T_failed",
        title: "Failed frontend"
      },
      {
        id: "T_pending",
        title: "Pending docs"
      }
    ]
  }), "2026-04-27T00:00:00.000Z");
  state.tasks.T_done!.status = "done";
  state.tasks.T_done!.result_summary = "Implemented backend handler.";
  state.tasks.T_done!.changed_files = ["src/backend.ts"];
  state.tasks.T_done!.tests_run = ["npm test"];
  state.tasks.T_done!.risks_found = [];
  state.tasks.T_done!.assigned_to = "backend-agent";
  state.tasks.T_failed!.status = "failed";
  state.waves.push({
    id: "wave_001",
    tasks: ["T_done", "T_failed"],
    status: "done",
    started_at: "2026-04-27T00:01:00.000Z",
    completed_at: "2026-04-27T00:05:00.000Z",
    review: {
      status: "passed",
      completed_tasks: ["T_done"],
      failed_tasks: [],
      conflicts: [],
      allow_next_wave: true
    },
    reason: "Test wave",
    skipped_ready_tasks: []
  });
  state.waves.push({
    id: "wave_002",
    tasks: ["T_pending"],
    status: "pending",
    started_at: null,
    completed_at: null,
    review: null,
    reason: "Not reviewed",
    skipped_ready_tasks: []
  });

  const candidates = extractExecutionMemoryCandidates(state, {
    now: "2026-04-27T00:10:00.000Z"
  });

  assert.equal(candidates.length, 1);
  assert.equal(candidates[0]?.category, "execution_result");
  assert.equal(candidates[0]?.title, "Task T_done: Implemented backend");
  assert.equal(candidates[0]?.summary, "Implemented backend handler.");
  assert.equal(candidates[0]?.confidence, "high");
  assert.deepEqual(candidates[0]?.content.changed_files, ["src/backend.ts"]);
  assert.deepEqual(candidates[0]?.content.tests_run, ["npm test"]);
  assert.deepEqual(candidates[0]?.tags, ["execution", "medium", "backend", "backend-agent"]);
  assert.deepEqual(candidates[0]?.provenance, {
    workflow_id: "wf_memory_extract",
    plan_id: "plan_memory_extract",
    wave_id: "wave_001",
    task_id: "T_done",
    source: "workflow_state",
    source_key: "wf_memory_extract:wave_001:T_done:execution_result",
    created_at: "2026-04-27T00:10:00.000Z"
  });
});

test("extractExecutionMemoryCandidates skips unfinished failed and unreviewed tasks", () => {
  const state = createInitialWorkflowState("wf_memory_skip", loadPlan({
    plan_id: "plan_memory_skip",
    plan_type: "dag",
    execution_policy: {},
    tasks: [
      { id: "T_running", title: "Running" },
      { id: "T_done_unreviewed", title: "Done but not reviewed" }
    ]
  }), "2026-04-27T00:00:00.000Z");
  state.tasks.T_running!.status = "running";
  state.tasks.T_done_unreviewed!.status = "done";
  state.waves.push({
    id: "wave_001",
    tasks: ["T_running", "T_done_unreviewed"],
    status: "running",
    started_at: "2026-04-27T00:01:00.000Z",
    completed_at: null,
    review: null,
    reason: "Not reviewed",
    skipped_ready_tasks: []
  });

  assert.deepEqual(extractExecutionMemoryCandidates(state), []);
});
