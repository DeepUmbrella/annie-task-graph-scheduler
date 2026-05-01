#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { createStateStore } from "./storage/state_store.js";
import { recoverWorkflow } from "./storage/recovery_manager.js";
import { exportVisualization, type VisualizationExport } from "./visualization/projection.js";
import { createWorkflowExecutionReport } from "./reporting/index.js";
import { startInboundServer } from "./server/inbound_server.js";
import { OpenClawAdapter, OpenClawCliClient } from "./communication/openclaw_adapter.js";
import { createPlannerTeamSnapshot } from "./team/index.js";
import { createBuiltinRegistry } from "./templates/index.js";
import { createInitialWorkflowState, instantiateTemplate, loadPlanFile } from "./validation/plan_loader.js";
import type { LoadedPlan } from "./validation/plan_loader.js";
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
  report --workflow <workflow_id>
  serve [--host <host>] [--port <port>] [--openclaw-planner-agent <agent_id>]
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
  plan validate --plan <plan.json>

Global options:
  --json-errors  Print CLI errors as JSON to stderr

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
} else if (command === "report") {
  await runReport();
} else if (command === "serve") {
  await runServe();
} else if (command === "template") {
  await runTemplate();
} else if (command === "project") {
  await runProject();
} else if (command === "queue") {
  await runQueue();
} else if (command === "memory") {
  await runMemory();
} else if (command === "plan") {
  await runPlan();
} else {
  console.error(`Command "${command}" is not implemented yet.`);
  process.exit(1);
}

function getArg(name: string): string | null {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] ?? null : null;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(name);
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
    for (const event of createSchedulerStatusAuditEvents(nextState, dependencyResolution.status_changes)) {
      await store.appendAuditEvent(event);
    }

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

async function runReport(): Promise<void> {
  const workflowId = getArg("--workflow");

  if (!workflowId) {
    console.error("Missing required --workflow <workflow_id>.");
    process.exit(1);
  }

  try {
    const state = await createCliStateStore().loadState(workflowId);
    console.log(JSON.stringify(createWorkflowExecutionReport(state), null, 2));
  } catch (error) {
    printCliError(error);
  }
}

async function runServe(): Promise<void> {
  const port = Number(getArg("--port") ?? "4317");
  const host = getArg("--host") ?? "127.0.0.1";
  const rootDir = getArg("--root") ?? ".annie";
  const openClawPlannerAgent = getArg("--openclaw-planner-agent");

  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    printCliError(new TaskGraphSchedulerError("Port is invalid.", "CLI_PORT_INVALID", {
      port
    }));
  }

  try {
    const started = await startInboundServer({
      host,
      port,
      rootDir,
      team: openClawPlannerAgent ? createPlannerTeamSnapshot(openClawPlannerAgent) : undefined,
      plannerTransport: openClawPlannerAgent ? new OpenClawAdapter(new OpenClawCliClient({
        timeout_seconds: Number(getArg("--openclaw-timeout") ?? "600"),
        thinking: getArg("--openclaw-thinking") ?? undefined,
        local: hasFlag("--openclaw-local"),
        deliver: hasFlag("--openclaw-deliver")
      })) : undefined
    });

    console.log(JSON.stringify({
      ok: true,
      service: "annie-task-graph-scheduler",
      url: started.url,
      endpoints: {
        health: `${started.url}/health`,
        openclaw_messages: `${started.url}/openclaw/messages`,
        nodes_register: `${started.url}/nodes/register`,
        nodes: `${started.url}/nodes`,
        node_candidates: `${started.url}/nodes/candidates`,
        plan_proposals: `${started.url}/plan-proposals`,
        workflow_bootstrap: `${started.url}/workflow-bootstrap`,
        agent_messages: `${started.url}/agent-messages`,
        annie_messages: `${started.url}/annie/messages`
      },
      inbound_log_path: started.logPath,
      node_registry_path: started.nodeRegistryPath,
      runtime_discovery_path: started.runtimeDiscoveryPath,
      plan_proposals_path: started.planProposalsPath,
      openclaw_planner_agent: openClawPlannerAgent ?? null,
      planner_transport: openClawPlannerAgent ? "openclaw_cli" : "mock"
    }, null, 2));
    console.log(`[annie-tgs:server] listening on ${started.url}`);
    console.log(`[annie-tgs:server] inbound log file ${started.logPath}`);
    console.log(`[annie-tgs:server] planner transport ${openClawPlannerAgent ? `openclaw_cli agent=${openClawPlannerAgent}` : "mock"}`);
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

async function runPlan(): Promise<void> {
  const subcommand = process.argv[3];

  try {
    if (subcommand === "validate") {
      const planPath = getRequiredArg("--plan", "Missing required --plan <plan.json>.");
      const loaded = await loadPlanFile(planPath);
      console.log(JSON.stringify(createPlanValidationSummary(loaded, planPath), null, 2));
    } else {
      console.error(`Unknown plan subcommand "${subcommand}". Use validate.`);
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

function createPlanValidationSummary(loaded: LoadedPlan, planPath: string) {
  const tasks = loaded.plan.tasks;
  const dependencyEdges = tasks.flatMap((task) =>
    (task.depends_on ?? []).map((dependencyId) => ({
      from: dependencyId,
      to: task.id
    }))
  );

  return {
    valid: true,
    path: planPath,
    plan_id: loaded.plan.plan_id,
    plan_type: loaded.plan.plan_type,
    task_count: tasks.length,
    topological_order: createTopologicalOrder(tasks),
    dependency_edge_count: dependencyEdges.length,
    dependency_edges: dependencyEdges,
    risks: countValues(tasks.map((task) => task.risk ?? "low")),
    required_capabilities: uniqueSorted(tasks.flatMap((task) => task.required_capabilities ?? [])),
    preferred_agents: uniqueSorted(tasks.map((task) => task.preferred_agent).filter((agent): agent is string => Boolean(agent))),
    expected_files_count: tasks.reduce((count, task) => count + (task.expected_files?.length ?? 0), 0),
    execution_policy: {
      max_parallel_tasks: loaded.execution_policy.max_parallel_tasks,
      max_agents: loaded.execution_policy.max_agents,
      same_file_conflict_policy: loaded.execution_policy.same_file_conflict_policy,
      review_after_each_wave: loaded.execution_policy.review_after_each_wave,
      stop_on_critical_failure: loaded.execution_policy.stop_on_critical_failure,
      selection_order: loaded.execution_policy.scheduling.selection_order,
      conflict_mode: loaded.execution_policy.conflicts.mode,
      max_retries: loaded.execution_policy.retry.max_retries
    }
  };
}

function createTopologicalOrder(tasks: LoadedPlan["plan"]["tasks"]): string[] {
  const taskIds = new Set(tasks.map((task) => task.id));
  const graph = new Map(tasks.map((task) => [task.id, [] as string[]]));
  const indegree = new Map(tasks.map((task) => [task.id, 0]));

  for (const task of tasks) {
    for (const dependencyId of task.depends_on ?? []) {
      if (!taskIds.has(dependencyId)) {
        continue;
      }
      graph.get(dependencyId)?.push(task.id);
      indegree.set(task.id, (indegree.get(task.id) ?? 0) + 1);
    }
  }

  const pending = tasks
    .map((task) => task.id)
    .filter((taskId) => (indegree.get(taskId) ?? 0) === 0);
  const order: string[] = [];

  while (pending.length > 0) {
    const taskId = pending.shift() as string;
    order.push(taskId);

    for (const downstreamId of graph.get(taskId) ?? []) {
      const nextIndegree = (indegree.get(downstreamId) ?? 0) - 1;
      indegree.set(downstreamId, nextIndegree);
      if (nextIndegree === 0) {
        pending.push(downstreamId);
      }
    }
  }

  return order;
}

function countValues(values: string[]): Record<string, number> {
  return values.reduce<Record<string, number>>((counts, value) => {
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
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

function createSchedulerStatusAuditEvents(
  state: WorkflowState,
  statusChanges: Array<{ task_id: string; from: string; to: string; reason: string }>
): AuditEvent[] {
  return statusChanges.map((change) => ({
    event_id: createCliAuditEventId(state.updated_at),
    workflow_id: state.workflow_id,
    type: "TASK_STATUS_CHANGED",
    payload: {
      task_id: change.task_id,
      from: change.from,
      to: change.to,
      reason: change.reason,
      source: "dependency_resolver"
    },
    created_at: state.updated_at
  }));
}

function createCliAuditEventId(now: string): string {
  return `evt_${Date.parse(now)}_${Math.random().toString(36).slice(2, 10)}`;
}

function printCliError(error: unknown): never {
  if (hasFlag("--json-errors")) {
    const payload = error instanceof TaskGraphSchedulerError
      ? {
          error: {
            code: error.code,
            message: error.message,
            details: error.details
          }
        }
      : {
          error: {
            code: "CLI_ERROR",
            message: error instanceof Error ? error.message : String(error),
            details: {}
          }
        };

    console.error(JSON.stringify(payload, null, 2));
    process.exit(1);
  }

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
