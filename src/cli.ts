#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { createStateStore } from "./storage/state_store.js";
import { recoverWorkflow } from "./storage/recovery_manager.js";
import { exportVisualization, type VisualizationExport } from "./visualization/projection.js";
import { createBuiltinRegistry } from "./templates/index.js";
import { createInitialWorkflowState, instantiateTemplate, loadPlanFile } from "./validation/plan_loader.js";
import { TaskGraphSchedulerError } from "./errors.js";
import {
  buildGlobalAgentPool,
  buildGlobalTaskQueue,
  createProjectRegistry,
  planCrossProjectDispatch
} from "./projects/index.js";
import { projectPriorities, userPriorities, type ProjectPriority, type ProjectRef, type ProjectWorkflowRef } from "./models/project.js";
import type { WorkflowState } from "./models/workflow.js";

const command = process.argv[2];

if (!command || command === "--help" || command === "-h") {
  console.log(`annie-tgs

Commands:
  init --plan <plan.json> [--workflow <workflow_id>]
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

Commands planned for future phases:
  next-wave --workflow <workflow_id>
  dispatch --workflow <workflow_id> --wave <wave_id>
  submit-result --workflow <workflow_id> --result <result.json>
  review-wave --workflow <workflow_id> --wave <wave_id>
`);
  process.exit(0);
}

if (command === "init") {
  await runInit();
} else if (command === "status") {
  await runStatus();
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

function getArgs(name: string): string[] {
  const values: string[] = [];
  for (let index = 0; index < process.argv.length; index += 1) {
    if (process.argv[index] === name && process.argv[index + 1]) {
      values.push(process.argv[index + 1]!);
    }
  }

  return values;
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
