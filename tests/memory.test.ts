import test from "node:test";
import assert from "node:assert/strict";
import {
  extractExecutionMemoryCandidates,
  extractPreferenceMemoryCandidates,
  extractTemplateMemoryCandidates,
  memoryCategories,
  memoryConfidenceLevels
} from "../src/index.js";
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

test("extractPreferenceMemoryCandidates extracts policy preferences", () => {
  const state = createInitialWorkflowState("wf_preference_extract", loadPlan({
    plan_id: "plan_preference_extract",
    plan_type: "dag",
    execution_policy: {
      max_parallel_tasks: 2,
      max_agents: 2,
      scheduling: {
        selection_order: "risk_aware",
        prefer_low_risk_first: true
      },
      conflicts: {
        mode: "directory",
        directory_conflict_depth: 2
      }
    },
    tasks: [
      { id: "T1", title: "One" },
      { id: "T2", title: "Two" }
    ]
  }), "2026-04-27T00:00:00.000Z");

  const candidates = extractPreferenceMemoryCandidates(state, {
    now: "2026-04-27T00:10:00.000Z"
  });

  assert.deepEqual(candidates.map((candidate) => candidate.provenance.source_key), [
    "wf_preference_extract:preference:concurrency",
    "wf_preference_extract:preference:conflict",
    "wf_preference_extract:preference:risk"
  ]);
  assert.equal(candidates.find((candidate) => candidate.provenance.source_key.endsWith(":risk"))?.confidence, "high");
  assert.deepEqual(candidates.find((candidate) => candidate.provenance.source_key.endsWith(":concurrency"))?.content, {
    max_parallel_tasks: 2,
    max_agents: 2,
    max_tasks_per_agent: 1,
    respect_preferred_agent: true
  });
  assert.deepEqual(candidates.find((candidate) => candidate.provenance.source_key.endsWith(":conflict"))?.content, {
    same_file_conflict_policy: "serialize",
    conflict_mode: "directory",
    directory_conflict_depth: 2,
    unknown_files_policy: "allow"
  });
});

test("extractPreferenceMemoryCandidates extracts skipped reason signals without mutating state", () => {
  const state = createInitialWorkflowState("wf_preference_skipped", loadPlan({
    plan_id: "plan_preference_skipped",
    plan_type: "dag",
    execution_policy: {},
    tasks: [
      { id: "T1", title: "One" },
      { id: "T2", title: "Two" }
    ]
  }), "2026-04-27T00:00:00.000Z");
  state.waves.push({
    id: "wave_001",
    tasks: ["T1"],
    status: "pending",
    started_at: null,
    completed_at: null,
    review: null,
    reason: "Test",
    skipped_ready_tasks: [
      {
        task_id: "T2",
        reason: "Skipped because exact file conflict on src/a.ts."
      }
    ]
  });
  const before = JSON.stringify(state);

  const candidates = extractPreferenceMemoryCandidates(state, {
    now: "2026-04-27T00:10:00.000Z"
  });

  assert.equal(JSON.stringify(state), before);
  const conflict = candidates.find((candidate) => candidate.provenance.source_key === "wf_preference_skipped:preference:skipped-conflict");
  assert.equal(conflict?.category, "preference");
  assert.equal(conflict?.confidence, "medium");
  assert.equal(conflict?.content.count, 1);
  assert.deepEqual(conflict?.tags, ["preference", "scheduler", "conflict"]);
});

test("extractTemplateMemoryCandidates extracts successful workflow shape", () => {
  const state = createInitialWorkflowState("wf_template_extract", loadPlan({
    plan_id: "plan_template_extract",
    plan_type: "dag",
    execution_policy: {},
    tasks: [
      {
        id: "T1",
        title: "Design API",
        required_capabilities: ["backend"],
        preferred_agent: "backend-agent",
        risk: "medium"
      },
      {
        id: "T2",
        title: "Implement API",
        depends_on: ["T1"],
        required_capabilities: ["backend"],
        preferred_agent: "backend-agent",
        risk: "high"
      }
    ]
  }), "2026-04-27T00:00:00.000Z");
  state.tasks.T1!.status = "done";
  state.tasks.T2!.status = "done";
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
    reason: "First wave",
    skipped_ready_tasks: []
  });
  state.waves.push({
    id: "wave_002",
    tasks: ["T2"],
    status: "done",
    started_at: "2026-04-27T00:03:00.000Z",
    completed_at: "2026-04-27T00:04:00.000Z",
    review: {
      status: "passed",
      completed_tasks: ["T2"],
      failed_tasks: [],
      conflicts: [],
      allow_next_wave: true
    },
    reason: "Second wave",
    skipped_ready_tasks: []
  });

  const candidates = extractTemplateMemoryCandidates(state, {
    now: "2026-04-27T00:10:00.000Z"
  });

  assert.equal(candidates.length, 1);
  assert.equal(candidates[0]?.category, "template_pattern");
  assert.equal(candidates[0]?.confidence, "high");
  assert.equal(candidates[0]?.provenance.source, "template_usage");
  assert.equal(candidates[0]?.provenance.source_key, "wf_template_extract:template_pattern:plan_template_extract");
  assert.deepEqual(candidates[0]?.content.dependency_edges, [{ from: "T1", to: "T2" }]);
  assert.deepEqual(candidates[0]?.content.capabilities, ["backend"]);
  assert.deepEqual(candidates[0]?.content.preferred_agents, ["backend-agent"]);
  assert.deepEqual(candidates[0]?.content.risks, ["high", "medium"]);
  assert.deepEqual(candidates[0]?.tags, ["backend", "high", "medium", "template", "workflow"]);
  assert.deepEqual((candidates[0]?.content.tasks as Array<{ id: string }>).map((task) => task.id), ["T1", "T2"]);
});

test("extractTemplateMemoryCandidates skips incomplete or failed workflows", () => {
  const incomplete = createInitialWorkflowState("wf_template_incomplete", loadPlan({
    plan_id: "plan_template_incomplete",
    plan_type: "dag",
    execution_policy: {},
    tasks: [{ id: "T1", title: "Only task" }]
  }), "2026-04-27T00:00:00.000Z");
  incomplete.tasks.T1!.status = "done";

  const failed = createInitialWorkflowState("wf_template_failed", loadPlan({
    plan_id: "plan_template_failed",
    plan_type: "dag",
    execution_policy: {},
    tasks: [{ id: "T1", title: "Only task" }]
  }), "2026-04-27T00:00:00.000Z");
  failed.tasks.T1!.status = "failed";
  failed.waves.push({
    id: "wave_001",
    tasks: ["T1"],
    status: "failed",
    started_at: "2026-04-27T00:01:00.000Z",
    completed_at: "2026-04-27T00:02:00.000Z",
    review: {
      status: "failed",
      completed_tasks: [],
      failed_tasks: ["T1"],
      conflicts: [],
      allow_next_wave: false
    },
    reason: "Failed wave",
    skipped_ready_tasks: []
  });

  assert.deepEqual(extractTemplateMemoryCandidates(incomplete), []);
  assert.deepEqual(extractTemplateMemoryCandidates(failed), []);
});
