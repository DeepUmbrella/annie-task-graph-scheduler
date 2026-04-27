#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { createStateStore } from "./storage/state_store.js";
import { recoverWorkflow } from "./storage/recovery_manager.js";
import { exportVisualization, type VisualizationExport } from "./visualization/projection.js";
import { createBuiltinRegistry } from "./templates/index.js";
import { createInitialWorkflowState, instantiateTemplate, loadPlanFile } from "./validation/plan_loader.js";
import { TaskGraphSchedulerError } from "./errors.js";
import { collectResult } from "./execution/result_collector.js";
import { reviewWave } from "./execution/review_gate.js";
import { assignWorkers } from "./execution/worker_pool.js";
import { resolveDependencies } from "./scheduler/dependency_resolver.js";
import { generateNextWave } from "./scheduler/scheduler.js";
import {
  buildGlobalAgentPool,
  buildGlobalTaskQueue,
  createProjectRegistry,
  planCrossProjectDispatch
} from "./projects/index.js";
import {
  createLocalMemoryStore,
  extractExecutionMemoryCandidates,
  extractPreferenceMemoryCandidates,
  extractTemplateMemoryCandidates,
  memoryCategories,
  type MemoryCandidate,
  type MemoryCategory
} from "./memory/index.js";
import { projectPriorities, userPriorities, type ProjectPriority, type ProjectRef, type ProjectWorkflowRef } from "./models/project.js";
import type { AuditEvent } from "./models/audit.js";
import type { WorkflowState } from "./models/workflow.js";

const command = process.argv[2];

if (!command || command === "--help" || command === "-h") {
  console.log(`annie-tgs

Commands:
  init --plan <plan.json> [--workflow <workflow_id>]
  next-wave --workflow <workflow_id>
  dispatch --workflow <workflow_id> --wave <wave_id>
  submit-result --workflow <workflow_id> --result <result.json>
  review-wave --workflow <workflow_id> --wave <wave_id>
  status --workflow <workflow_id>
  recover --workflow <workflow_id>
  visualize --workflow <workflow_id>
  template list
  template show --template <template_id>
  template instantiate --template <template_id> --plan-id <plan_id>
  project register --project <project_id> --name <name> --root-path <path>
  project list
  project show --project <project_id>
  queue build [--project <project_id> --workflow <workflow_id>]
  queue plan [--project <project_id> --workflow <workflow_id>]
  memory extract --workflow <workflow_id>
  memory write --workflow <workflow_id>
  memory list [--category <category>]

`);
  process.exit(0);
}

if (command === "init") {
  await runInit();
} else if (command === "status") {
  await runStatus();
} else if (command === "next-wave") {
  await runNextWave();
} else if (command === "dispatch") {
  await runDispatch();
} else if (command === "submit-result") {
  await runSubmitResult();
} else if (command === "review-wave") {
  await runReviewWave();
} else if (command === "recover") {
  await runRecover();
} else if (command === "visualize") {
  await runVisualize();
} else if (command === "template") {
  await runTemplate();
} else if (command === "project") {
  await runProject();
} else if (command === "queue") {
  await runQueue();
} else if (command === "memory") {
  await runMemory();
} else {
  console.error(`Command "${command}" is not implemented yet.`);
  process.exit(1);
}

function getArg(name: string): string | null {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] ?? null : null;
}

function createCliStateStore() {
  return createStateStore(getArg("--root") ?? ".annie");
}

function createCliProjectRegistry() {
  return createProjectRegistry(getArg("--root") ?? ".annie");
}

function createCliMemoryStore() {
  return createLocalMemoryStore(getArg("--root") ?? ".annie");
}

async function runInit(): Promise<void> {
  const planPath = getArg("--plan");

  if (!planPath) {
    console.error("Missing required --plan <plan.json>.");
    process.exit(1);
  }

  try {
    const loaded = await loadPlanFile(planPath);
    const workflowId = getArg("--workflow") ?? createWorkflowId(loaded.plan.plan_id);
    const store = createCliStateStore();
    const state = createInitialWorkflowState(workflowId, loaded);
    await store.saveState(state);

    console.log(JSON.stringify({
      workflow_id: state.workflow_id,
      plan_id: state.plan_id,
      status: state.status,
      task_count: Object.keys(state.tasks).length,
      state_path: store.statePath(state.workflow_id)
    }, null, 2));
  } catch (error) {
    printCliError(error);
  }
}

async function runStatus(): Promise<void> {
  const workflowId = getArg("--workflow");

  if (!workflowId) {
    console.error("Missing required --workflow <workflow_id>.");
    process.exit(1);
  }

  try {
    const state = await createCliStateStore().loadState(workflowId);
    console.log(JSON.stringify({
      workflow_id: state.workflow_id,
      plan_id: state.plan_id,
      status: state.status,
      current_wave: state.current_wave,
      tasks: Object.fromEntries(Object.entries(state.tasks).map(([taskId, task]) => [taskId, task.status])),
      waves: state.waves.map((wave) => ({ id: wave.id, status: wave.status, tasks: wave.tasks }))
    }, null, 2));
  } catch (error) {
    printCliError(error);
  }
}

async function runNextWave(): Promise<void> {
  const workflowId = getArg("--workflow");

  if (!workflowId) {
    console.error("Missing required --workflow <workflow_id>.");
    process.exit(1);
  }

  try {
    const store = createCliStateStore();
    const state = await store.loadState(workflowId);
    const dependencyResolution = resolveDependencies(state);
    const nextWave = generateNextWave(dependencyResolution.state);
    const nextState: WorkflowState = {
      ...dependencyResolution.state,
      waves: nextWave.wave
        ? [...dependencyResolution.state.waves, nextWave.wave]
        : dependencyResolution.state.waves
    };
    await store.saveState(nextState);

    console.log(JSON.stringify({
      workflow_id: nextState.workflow_id,
      ready_task_ids: nextWave.ready_task_ids,
      blocked_task_ids: dependencyResolution.blocked_task_ids,
      status_changes: dependencyResolution.status_changes,
      wave: nextWave.wave,
      skipped_ready_tasks: nextWave.skipped_ready_tasks,
      decision: nextWave.decision
    }, null, 2));
  } catch (error) {
    printCliError(error);
  }
}

async function runDispatch(): Promise<void> {
  const workflowId = getArg("--workflow");
  const waveId = getArg("--wave");

  if (!workflowId) {
    console.error("Missing required --workflow <workflow_id>.");
    process.exit(1);
  }
  if (!waveId) {
    console.error("Missing required --wave <wave_id>.");
    process.exit(1);
  }

  try {
    const store = createCliStateStore();
    const state = await store.loadState(workflowId);
    const wave = state.waves.find((candidate) => candidate.id === waveId);

    if (!wave) {
      throw new TaskGraphSchedulerError("Wave does not exist.", "WAVE_NOT_FOUND", {
        workflow_id: workflowId,
        wave_id: waveId
      });
    }

    const result = assignWorkers(state, wave);
    await store.saveState(result.state);
    for (const event of result.audit_events) {
      await store.appendAuditEvent(event);
    }

    console.log(JSON.stringify({
      workflow_id: result.state.workflow_id,
      wave_id: waveId,
      assignments: result.assignments,
      audit_events: result.audit_events.length,
      state: {
        status: result.state.status,
        current_wave: result.state.current_wave,
        wave_status: result.state.waves.find((candidate) => candidate.id === waveId)?.status ?? null
      }
    }, null, 2));
  } catch (error) {
    printCliError(error);
  }
}

async function runSubmitResult(): Promise<void> {
  const workflowId = getArg("--workflow");
  const resultPath = getArg("--result");

  if (!workflowId) {
    console.error("Missing required --workflow <workflow_id>.");
    process.exit(1);
  }
  if (!resultPath) {
    console.error("Missing required --result <result.json>.");
    process.exit(1);
  }

  try {
    const store = createCliStateStore();
    const state = await store.loadState(workflowId);
    const workerResult = await loadJsonFile(resultPath, "WORKER_RESULT_READ_FAILED");
    const result = collectResult(state, workerResult);
    await store.saveState(result.state);
    for (const event of result.audit_events) {
      await store.appendAuditEvent(event);
    }

    const taskId = (workerResult as { task_id?: unknown }).task_id;
    const task = typeof taskId === "string" ? result.state.tasks[taskId] : undefined;
    console.log(JSON.stringify({
      workflow_id: result.state.workflow_id,
      task_id: task?.id ?? null,
      status: task?.status ?? null,
      assigned_to: task?.assigned_to ?? null,
      retry_count: task?.retry_count ?? null,
      changed_files: task?.changed_files ?? [],
      tests_run: task?.tests_run ?? [],
      risks_found: task?.risks_found ?? [],
      audit_events: result.audit_events.length
    }, null, 2));
  } catch (error) {
    printCliError(error);
  }
}

async function runReviewWave(): Promise<void> {
  const workflowId = getArg("--workflow");
  const waveId = getArg("--wave");

  if (!workflowId) {
    console.error("Missing required --workflow <workflow_id>.");
    process.exit(1);
  }
  if (!waveId) {
    console.error("Missing required --wave <wave_id>.");
    process.exit(1);
  }

  try {
    const store = createCliStateStore();
    const state = await store.loadState(workflowId);
    const result = reviewWave(state, waveId);
    const auditEvents = createReviewAuditEvents(state, result.state, waveId);
    await store.saveState(result.state);
    for (const event of auditEvents) {
      await store.appendAuditEvent(event);
    }

    console.log(JSON.stringify({
      workflow_id: result.state.workflow_id,
      wave_id: waveId,
      review: result.review,
      audit_events: auditEvents.length,
      state: {
        status: result.state.status,
        current_wave: result.state.current_wave,
        wave_status: result.state.waves.find((candidate) => candidate.id === waveId)?.status ?? null
      }
    }, null, 2));
  } catch (error) {
    printCliError(error);
  }
}

async function runRecover(): Promise<void> {
  const workflowId = getArg("--workflow");

  if (!workflowId) {
    console.error("Missing required --workflow <workflow_id>.");
    process.exit(1);
  }

  try {
    const result = await recoverWorkflow(createCliStateStore(), workflowId);
    console.log(JSON.stringify({
      workflow_id: result.state.workflow_id,
      recovered_task_ids: result.recovered_task_ids,
      audit_events: result.audit_events.length
    }, null, 2));
  } catch (error) {
    printCliError(error);
  }
}

async function runVisualize(): Promise<void> {
  const workflowId = getArg("--workflow");

  if (!workflowId) {
    console.error("Missing required --workflow <workflow_id>.");
    process.exit(1);
  }

  try {
    const state = await createCliStateStore().loadState(workflowId);
    const result = exportVisualization(state);

    if (result.ok) {
      console.log(JSON.stringify(result.data, null, 2));
    } else {
      console.error(`${result.error.code}: ${result.error.message}`);
      process.exit(1);
    }
  } catch (error) {
    printCliError(error);
  }
}

async function runTemplate(): Promise<void> {
  const subcommand = process.argv[3];
  const registry = createBuiltinRegistry();

  if (subcommand === "list") {
    const templates = registry.list();
    for (const t of templates) {
      console.log(`${t.id}  ${t.name}  [${t.tags.join(", ")}]`);
    }
  } else if (subcommand === "show") {
    const templateId = getArg("--template");
    if (!templateId) {
      console.error("Missing required --template <template_id>.");
      process.exit(1);
    }
    const template = registry.get(templateId);
    if (!template) {
      console.error(`Template "${templateId}" not found.`);
      process.exit(1);
    }
    console.log(JSON.stringify(template, null, 2));
  } else if (subcommand === "instantiate") {
    const templateId = getArg("--template");
    const planId = getArg("--plan-id");
    if (!templateId) {
      console.error("Missing required --template <template_id>.");
      process.exit(1);
    }
    if (!planId) {
      console.error("Missing required --plan-id <plan_id>.");
      process.exit(1);
    }
    const template = registry.get(templateId);
    if (!template) {
      console.error(`Template "${templateId}" not found.`);
      process.exit(1);
    }
    try {
      const loaded = instantiateTemplate(template, { plan_id: planId });
      console.log(JSON.stringify(loaded.plan, null, 2));
    } catch (error) {
      printCliError(error);
    }
  } else {
    console.error(`Unknown template subcommand "${subcommand}". Use list, show, or instantiate.`);
    process.exit(1);
  }
}

async function runProject(): Promise<void> {
  const subcommand = process.argv[3];
  const registry = createCliProjectRegistry();

  try {
    if (subcommand === "register") {
      const projectId = getArg("--project");
      const name = getArg("--name");
      const rootPath = getArg("--root-path");

      if (!projectId) {
        console.error("Missing required --project <project_id>.");
        process.exit(1);
      }
      if (!name) {
        console.error("Missing required --name <name>.");
        process.exit(1);
      }
      if (!rootPath) {
        console.error("Missing required --root-path <path>.");
        process.exit(1);
      }

      const project = await registry.registerProject({
        project_id: projectId,
        name,
        root_path: rootPath,
        priority: parseProjectPriority(getArg("--priority") ?? "normal"),
        tags: getArgs("--tag")
      });
      console.log(JSON.stringify(project, null, 2));
    } else if (subcommand === "list") {
      console.log(JSON.stringify(await registry.listProjects(), null, 2));
    } else if (subcommand === "show") {
      const projectId = getArg("--project");
      if (!projectId) {
        console.error("Missing required --project <project_id>.");
        process.exit(1);
      }

      const project = await registry.getProject(projectId);
      if (!project) {
        throw new TaskGraphSchedulerError("Project does not exist.", "PROJECT_NOT_FOUND", {
          project_id: projectId
        });
      }

      console.log(JSON.stringify({
        project,
        workflows: await registry.listWorkflows(projectId)
      }, null, 2));
    } else {
      console.error(`Unknown project subcommand "${subcommand}". Use register, list, or show.`);
      process.exit(1);
    }
  } catch (error) {
    printCliError(error);
  }
}

async function runQueue(): Promise<void> {
  const subcommand = process.argv[3];

  try {
    const inputs = await loadGlobalQueueInputs();
    const queue = buildGlobalTaskQueue(inputs);

    if (subcommand === "build") {
      console.log(JSON.stringify(queue, null, 2));
    } else if (subcommand === "plan") {
      const agentPool = buildGlobalAgentPool(inputs.map((input) => ({
        project_id: input.project.project_id,
        workflow_id: input.workflow.workflow_id,
        agents: input.state.agents
      })));
      const plan = planCrossProjectDispatch(queue.items, agentPool.agents);
      console.log(JSON.stringify({
        queue,
        agent_pool: agentPool,
        dispatch_plan: plan
      }, null, 2));
    } else {
      console.error(`Unknown queue subcommand "${subcommand}". Use build or plan.`);
      process.exit(1);
    }
  } catch (error) {
    printCliError(error);
  }
}

async function runMemory(): Promise<void> {
  const subcommand = process.argv[3];

  try {
    if (subcommand === "extract") {
      const workflowId = getRequiredArg("--workflow", "Missing required --workflow <workflow_id>.");
      const state = await createCliStateStore().loadState(workflowId);
      const candidates = extractAllMemoryCandidates(state);

      console.log(JSON.stringify({
        workflow_id: state.workflow_id,
        candidate_count: candidates.length,
        candidates
      }, null, 2));
    } else if (subcommand === "write") {
      const workflowId = getRequiredArg("--workflow", "Missing required --workflow <workflow_id>.");
      const state = await createCliStateStore().loadState(workflowId);
      const candidates = extractAllMemoryCandidates(state);
      const store = createCliMemoryStore();
      const records = [];

      for (const candidate of candidates) {
        records.push(await store.append(candidate));
      }

      console.log(JSON.stringify({
        workflow_id: state.workflow_id,
        candidate_count: candidates.length,
        record_count: records.length,
        records_path: store.recordsPath(),
        records
      }, null, 2));
    } else if (subcommand === "list") {
      const category = getArg("--category");
      const records = await createCliMemoryStore().list({
        category: category ? parseMemoryCategory(category) : undefined
      });
      console.log(JSON.stringify(records, null, 2));
    } else {
      console.error(`Unknown memory subcommand "${subcommand}". Use extract, write, or list.`);
      process.exit(1);
    }
  } catch (error) {
    printCliError(error);
  }
}

async function loadGlobalQueueInputs(): Promise<Array<{ project: ProjectRef; workflow: ProjectWorkflowRef; state: WorkflowState }>> {
  const projectId = getArg("--project");
  const workflowId = getArg("--workflow");
  const registry = createCliProjectRegistry();
  const store = createCliStateStore();

  if (projectId || workflowId) {
    if (!projectId || !workflowId) {
      throw new TaskGraphSchedulerError("Both --project and --workflow are required when either is provided.", "QUEUE_INPUT_INVALID", {
        project_id: projectId,
        workflow_id: workflowId
      });
    }

    const project = await registry.getProject(projectId);
    if (!project) {
      throw new TaskGraphSchedulerError("Project does not exist.", "PROJECT_NOT_FOUND", {
        project_id: projectId
      });
    }

    const state = await store.loadState(workflowId);
    return [{
      project,
      workflow: {
        project_id: project.project_id,
        workflow_id: state.workflow_id,
        plan_id: state.plan_id,
        state_path: store.statePath(state.workflow_id),
        status: state.status,
        priority: parseUserPriority(getArg("--priority") ?? "normal"),
        registered_at: state.created_at,
        updated_at: state.updated_at
      },
      state
    }];
  }

  const projects = new Map((await registry.listProjects()).map((project) => [project.project_id, project]));
  const workflows = await registry.listWorkflows();
  const inputs: Array<{ project: ProjectRef; workflow: ProjectWorkflowRef; state: WorkflowState }> = [];

  for (const workflow of workflows) {
    const project = projects.get(workflow.project_id);
    if (!project) {
      throw new TaskGraphSchedulerError("Workflow references a missing project.", "PROJECT_NOT_FOUND", {
        project_id: workflow.project_id,
        workflow_id: workflow.workflow_id
      });
    }

    inputs.push({
      project,
      workflow,
      state: await loadWorkflowStateFromPath(workflow.state_path)
    });
  }

  return inputs;
}

async function loadWorkflowStateFromPath(statePath: string): Promise<WorkflowState> {
  try {
    return JSON.parse(await readFile(statePath, "utf8")) as WorkflowState;
  } catch (error) {
    throw new TaskGraphSchedulerError("Failed to load workflow state.", "STATE_LOAD_FAILED", {
      path: statePath,
      cause: error instanceof Error ? error.message : String(error)
    });
  }
}

async function loadJsonFile(path: string, errorCode: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as unknown;
  } catch (error) {
    throw new TaskGraphSchedulerError("Failed to read JSON file.", errorCode, {
      path,
      cause: error instanceof Error ? error.message : String(error)
    });
  }
}

function getArgs(name: string): string[] {
  const values: string[] = [];
  for (let index = 0; index < process.argv.length; index += 1) {
    if (process.argv[index] === name && process.argv[index + 1]) {
      values.push(process.argv[index + 1]!);
    }
  }

  return values;
}

function getRequiredArg(name: string, message: string): string {
  const value = getArg(name);
  if (!value) {
    throw new TaskGraphSchedulerError(message, "CLI_ARGUMENT_MISSING", {
      argument: name
    });
  }

  return value;
}

function extractAllMemoryCandidates(state: WorkflowState): MemoryCandidate[] {
  return [
    ...extractExecutionMemoryCandidates(state),
    ...extractPreferenceMemoryCandidates(state),
    ...extractTemplateMemoryCandidates(state)
  ];
}

function parseMemoryCategory(value: string): MemoryCategory {
  if ((memoryCategories as readonly string[]).includes(value)) {
    return value as MemoryCategory;
  }

  throw new TaskGraphSchedulerError("Memory category is invalid.", "MEMORY_CATEGORY_INVALID", {
    value,
    allowed: memoryCategories
  });
}

function parseProjectPriority(value: string): ProjectPriority {
  if ((projectPriorities as readonly string[]).includes(value)) {
    return value as ProjectPriority;
  }

  throw new TaskGraphSchedulerError("Project priority is invalid.", "PROJECT_PRIORITY_INVALID", {
    value,
    allowed: projectPriorities
  });
}

function parseUserPriority(value: string): ProjectWorkflowRef["priority"] {
  if ((userPriorities as readonly string[]).includes(value)) {
    return value as ProjectWorkflowRef["priority"];
  }

  throw new TaskGraphSchedulerError("User priority is invalid.", "USER_PRIORITY_INVALID", {
    value,
    allowed: userPriorities
  });
}

function createWorkflowId(planId: string): string {
  const safePlanId = planId
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return `wf_${safePlanId || "workflow"}`;
}

function createReviewAuditEvents(previous: WorkflowState, next: WorkflowState, waveId: string): AuditEvent[] {
  const now = next.updated_at;
  const events: AuditEvent[] = [{
    event_id: createCliAuditEventId(now),
    workflow_id: next.workflow_id,
    type: "WAVE_REVIEWED",
    payload: {
      wave_id: waveId,
      status: next.waves.find((wave) => wave.id === waveId)?.review?.status ?? null,
      allow_next_wave: next.waves.find((wave) => wave.id === waveId)?.review?.allow_next_wave ?? null
    },
    created_at: now
  }];

  for (const [taskId, task] of Object.entries(next.tasks)) {
    const previousTask = previous.tasks[taskId];
    if (previousTask && previousTask.status !== task.status) {
      events.push({
        event_id: createCliAuditEventId(now),
        workflow_id: next.workflow_id,
        type: "TASK_STATUS_CHANGED",
        payload: {
          task_id: taskId,
          from: previousTask.status,
          to: task.status,
          wave_id: waveId
        },
        created_at: now
      });
    }
  }

  return events;
}

function createCliAuditEventId(now: string): string {
  return `evt_${Date.parse(now)}_${Math.random().toString(36).slice(2, 10)}`;
}

function printCliError(error: unknown): never {
  if (error instanceof TaskGraphSchedulerError) {
    console.error(`${error.code}: ${error.message}`);
    if (Object.keys(error.details).length > 0) {
      console.error(JSON.stringify(error.details, null, 2));
    }
  } else {
    console.error(error instanceof Error ? error.message : String(error));
  }

  process.exit(1);
}
