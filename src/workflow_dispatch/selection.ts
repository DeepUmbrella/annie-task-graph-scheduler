import { TaskGraphSchedulerError } from "../errors.js";
import type { Task } from "../models/task.js";
import type { Wave } from "../models/wave.js";
import type { WorkflowState } from "../models/workflow.js";
import type { NodeRegistrySnapshot, RegisteredNode } from "../node_registry/index.js";
import type {
  WorkflowDispatchRejection,
  WorkflowDispatchSelection,
  WorkflowDispatchSelectionResult
} from "./model.js";

export interface SelectDispatchTargetsInput {
  state: WorkflowState;
  registry: NodeRegistrySnapshot;
  wave_id?: string;
}

export function selectDispatchTargets(input: SelectDispatchTargetsInput): WorkflowDispatchSelectionResult {
  const wave = resolveDispatchWave(input.state, input.wave_id);

  if (!wave) {
    return {
      workflow_id: input.state.workflow_id,
      wave_id: null,
      selections: [],
      rejections: []
    };
  }

  const selections: WorkflowDispatchSelection[] = [];
  const rejections: WorkflowDispatchRejection[] = [];

  for (const taskId of wave.tasks) {
    const task = input.state.tasks[taskId];

    if (!task) {
      rejections.push({
        task_id: taskId,
        code: "TASK_NOT_FOUND",
        reason: `Wave references missing task ${taskId}.`
      });
      continue;
    }

    if (task.status === "assigned") {
      selections.push({
        task_id: task.id,
        node_id: task.assigned_to ?? "",
        decision: "already_assigned"
      });
      continue;
    }

    if (task.status !== "ready") {
      rejections.push({
        task_id: task.id,
        code: "TASK_NOT_READY_FOR_DISPATCH",
        reason: `Task status is ${task.status}; only ready tasks can be dispatched.`
      });
      continue;
    }

    const selected = selectNodeForTask(task, input.registry.nodes);

    if (!selected) {
      rejections.push({
        task_id: task.id,
        code: "NO_ELIGIBLE_NODE",
        reason: createNoEligibleNodeReason(task)
      });
      continue;
    }

    selections.push({
      task_id: task.id,
      node_id: selected.node.node_id,
      decision: selected.decision
    });
  }

  return {
    workflow_id: input.state.workflow_id,
    wave_id: wave.id,
    selections,
    rejections
  };
}

export function resolveDispatchWave(state: WorkflowState, waveId?: string): Wave | null {
  if (waveId) {
    const wave = state.waves.find((candidate) => candidate.id === waveId);
    if (!wave) {
      throw new TaskGraphSchedulerError("Wave does not exist.", "WAVE_NOT_FOUND", {
        workflow_id: state.workflow_id,
        wave_id: waveId
      });
    }

    return wave;
  }

  if (!state.current_wave) {
    return null;
  }

  return state.waves.find((candidate) => candidate.id === state.current_wave) ?? null;
}

interface NodeSelection {
  node: RegisteredNode;
  decision: string;
}

function selectNodeForTask(task: Task, nodes: RegisteredNode[]): NodeSelection | null {
  const activeNodes = nodes.filter((node) => node.status === "active");

  if (task.preferred_agent) {
    const preferred = activeNodes.find((node) => node.node_id === task.preferred_agent);

    if (preferred && canNodeRunTask(preferred, task)) {
      return {
        node: preferred,
        decision: "preferred_node_available"
      };
    }
  }

  const capable = activeNodes
    .filter((node) => canNodeRunTask(node, task))
    .sort((left, right) => left.node_id.localeCompare(right.node_id));

  if (capable[0]) {
    return {
      node: capable[0],
      decision: "capability_match"
    };
  }

  return null;
}

function canNodeRunTask(node: RegisteredNode, task: Task): boolean {
  if (task.required_capabilities.length === 0) {
    return true;
  }

  return task.required_capabilities.every((capability) => node.declared_capabilities.includes(capability));
}

function createNoEligibleNodeReason(task: Task): string {
  if (task.preferred_agent) {
    return `No active registered node can run task ${task.id}; preferred node ${task.preferred_agent} is unavailable or lacks required capabilities.`;
  }

  return `No active registered node has required capabilities for task ${task.id}.`;
}
