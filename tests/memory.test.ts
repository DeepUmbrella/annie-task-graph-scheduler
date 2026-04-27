import test from "node:test";
import assert from "node:assert/strict";
import { memoryCategories, memoryConfidenceLevels } from "../src/index.js";
import type { MemoryAdapter, MemoryCandidate, MemoryRecord } from "../src/index.js";

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
