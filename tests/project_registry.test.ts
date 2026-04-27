import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { TaskGraphSchedulerError, createProjectRegistry } from "../src/index.js";

test("project registry returns empty lists when file does not exist", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "annie-tgs-projects-empty-"));
  const registry = createProjectRegistry(rootDir);

  assert.deepEqual(await registry.listProjects(), []);
  assert.deepEqual(await registry.listWorkflows(), []);
  assert.deepEqual(await registry.loadSnapshot(), {
    version: 1,
    projects: [],
    workflows: [],
    updated_at: null
  });
});

test("project registry registers reads lists and persists projects", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "annie-tgs-projects-register-"));
  const registry = createProjectRegistry(rootDir);

  const project = await registry.registerProject({
    project_id: "project_api",
    name: "API",
    root_path: "/workspace/api",
    priority: "high",
    tags: ["backend"]
  }, {
    now: "2026-04-27T01:00:00.000Z"
  });

  assert.equal(project.project_id, "project_api");
  assert.equal(project.priority, "high");
  assert.deepEqual(await registry.getProject("project_api"), project);
  assert.deepEqual(await registry.listProjects(), [project]);

  const raw = await readFile(registry.registryPath(), "utf8");
  const persisted = JSON.parse(raw) as { projects: Array<{ project_id: string }> };
  assert.deepEqual(persisted.projects.map((item) => item.project_id), ["project_api"]);
});

test("project registry updates project priority", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "annie-tgs-projects-update-"));
  const registry = createProjectRegistry(rootDir);

  await registry.registerProject({
    project_id: "project_docs",
    name: "Docs",
    root_path: "/workspace/docs"
  }, {
    now: "2026-04-27T01:00:00.000Z"
  });

  const updated = await registry.updateProject("project_docs", {
    priority: "urgent"
  }, {
    now: "2026-04-27T01:05:00.000Z"
  });

  assert.equal(updated.priority, "urgent");
  assert.equal(updated.updated_at, "2026-04-27T01:05:00.000Z");
  assert.equal((await registry.getProject("project_docs"))?.priority, "urgent");
});

test("project registry stores workflow state references", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "annie-tgs-projects-workflows-"));
  const registry = createProjectRegistry(rootDir);

  await registry.registerProject({
    project_id: "project_app",
    name: "App",
    root_path: "/workspace/app"
  }, {
    now: "2026-04-27T01:00:00.000Z"
  });

  const workflow = await registry.registerWorkflow({
    project_id: "project_app",
    workflow_id: "wf_app",
    plan_id: "plan_app",
    priority: "focus"
  }, {
    now: "2026-04-27T01:02:00.000Z"
  });

  assert.equal(workflow.state_path, join(rootDir, "workflows", "wf_app", "state.json"));
  assert.deepEqual(await registry.listWorkflows("project_app"), [workflow]);
});

test("project registry returns structured errors", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "annie-tgs-projects-errors-"));
  const registry = createProjectRegistry(rootDir);

  await registry.registerProject({
    project_id: "project_app",
    name: "App",
    root_path: "/workspace/app"
  });

  await assert.rejects(
    () => registry.registerProject({
      project_id: "project_app",
      name: "Duplicate",
      root_path: "/workspace/duplicate"
    }),
    (error) => error instanceof TaskGraphSchedulerError
      && error.code === "PROJECT_ALREADY_EXISTS"
  );

  await assert.rejects(
    () => registry.updateProject("missing", { priority: "high" }),
    (error) => error instanceof TaskGraphSchedulerError
      && error.code === "PROJECT_NOT_FOUND"
  );
});
