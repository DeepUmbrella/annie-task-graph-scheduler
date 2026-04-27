#!/usr/bin/env node

import { createStateStore } from "./storage/state_store.js";
import { recoverWorkflow } from "./storage/recovery_manager.js";
import { exportVisualization, type VisualizationExport } from "./visualization/projection.js";
import { TaskGraphSchedulerError } from "./errors.js";

const command = process.argv[2];

if (!command || command === "--help" || command === "-h") {
  console.log(`annie-tgs

Commands:
  status --workflow <workflow_id>
  recover --workflow <workflow_id>
  visualize --workflow <workflow_id>

Commands planned for future phases:
  init --plan <plan.json>
  next-wave --workflow <workflow_id>
  dispatch --workflow <workflow_id> --wave <wave_id>
  submit-result --workflow <workflow_id> --result <result.json>
  review-wave --workflow <workflow_id> --wave <wave_id>
`);
  process.exit(0);
}

if (command === "status") {
  await runStatus();
} else if (command === "recover") {
  await runRecover();
} else if (command === "visualize") {
  await runVisualize();
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
