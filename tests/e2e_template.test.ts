import test from "node:test";
import assert from "node:assert/strict";
import { createTemplateRegistry, createBuiltinRegistry, builtinTemplates } from "../src/templates/index.js";
import { instantiateTemplate, createInitialWorkflowState } from "../src/validation/plan_loader.js";
import { resolveDependencies } from "../src/scheduler/dependency_resolver.js";
import { generateNextWave } from "../src/scheduler/scheduler.js";
import type { TaskTemplate } from "../src/models/template.js";

test("createTemplateRegistry supports register/get/list/findByTag", () => {
  const registry = createTemplateRegistry();
  const t: TaskTemplate = {
    id: "test-tpl",
    name: "Test",
    description: "A test template",
    tasks: [{ id: "T1", title: "Task" }],
    execution_policy: {},
    tags: ["test", "unit"],
    version: 1,
    created_at: "2026-04-27T00:00:00.000Z"
  };

  registry.register(t);
  assert.equal(registry.get("test-tpl")?.name, "Test");
  assert.equal(registry.get("missing"), undefined);
  assert.equal(registry.list().length, 1);
  assert.equal(registry.findByTag("unit").length, 1);
  assert.equal(registry.findByTag("missing").length, 0);
});

test("createBuiltinRegistry has 3 templates", () => {
  const registry = createBuiltinRegistry();
  assert.equal(registry.list().length, 3);
  assert.equal(registry.get("api-design-implement-test") != null, true);
  assert.equal(registry.get("parallel-frontend-backend") != null, true);
  assert.equal(registry.get("full-stack-review") != null, true);
});

test("findByTag returns correct templates", () => {
  const registry = createBuiltinRegistry();
  const parallel = registry.findByTag("parallel");
  assert.equal(parallel.length, 2);
  const review = registry.findByTag("review");
  assert.equal(review.length, 1);
  assert.equal(review[0]!.id, "full-stack-review");
});

test("instantiateTemplate produces valid LoadedPlan from builtin", () => {
  const template = builtinTemplates[0]!;
  const loaded = instantiateTemplate(template, { plan_id: "my-plan" });

  assert.equal(loaded.plan.plan_id, "my-plan");
  assert.equal(loaded.plan.plan_type, "dag");
  assert.equal(loaded.plan.tasks.length, template.tasks.length);
  assert.equal(loaded.execution_policy.max_parallel_tasks, 3);
});

test("instantiateTemplate with task_overrides", () => {
  const template = builtinTemplates[0]!;
  const loaded = instantiateTemplate(template, {
    plan_id: "overridden-plan",
    task_overrides: {
      T1: { title: "Custom API Design", risk: "high" }
    }
  });

  const t1 = loaded.plan.tasks.find((t) => t.id === "T1");
  assert.equal(t1?.title, "Custom API Design");
  assert.equal(t1?.risk, "high");
});

test("instantiateTemplate with extra_tasks", () => {
  const template = builtinTemplates[0]!;
  const loaded = instantiateTemplate(template, {
    plan_id: "extra-plan",
    extra_tasks: [{ id: "T5", title: "Deploy", depends_on: ["T4"] }]
  });

  assert.equal(loaded.plan.tasks.length, template.tasks.length + 1);
  assert.equal(loaded.plan.tasks.find((t) => t.id === "T5")?.title, "Deploy");
});

test("instantiateTemplate with execution_policy_overrides", () => {
  const template = builtinTemplates[0]!;
  const loaded = instantiateTemplate(template, {
    plan_id: "policy-plan",
    execution_policy_overrides: { max_parallel_tasks: 10 }
  });

  assert.equal(loaded.execution_policy.max_parallel_tasks, 10);
});

test("full-stack-review template runs through scheduler successfully", () => {
  const template = builtinTemplates.find((t) => t.id === "full-stack-review")!;
  const loaded = instantiateTemplate(template, { plan_id: "fsr-plan" });
  let state = createInitialWorkflowState("wf_fsr", loaded, "2026-04-27T00:00:00.000Z");

  state = resolveDependencies(state).state;
  assert.equal(state.tasks.T1?.status, "ready");
  assert.equal(state.tasks.T2?.status, "pending");

  const wave = generateNextWave(state).wave;
  assert.deepEqual(wave?.tasks, ["T1"]);
});
