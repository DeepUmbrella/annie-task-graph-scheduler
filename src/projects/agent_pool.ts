import type { GlobalAgentRuntimeState, GlobalTaskQueueItem } from "../models/project.js";
import type { AgentRuntimeState } from "../models/workflow.js";
import { createGlobalTaskId } from "./global_queue.js";

export interface AgentPoolWorkflowInput {
  project_id: string;
  workflow_id: string;
  agents: Record<string, AgentRuntimeState>;
}

export interface GlobalAgentPool {
  agents: GlobalAgentRuntimeState[];
  totals: {
    total_agents: number;
    online_agents: number;
    offline_agents: number;
    max_concurrent_tasks: number;
    active_global_task_count: number;
    capacity_remaining: number;
  };
}

export function buildGlobalAgentPool(inputs: AgentPoolWorkflowInput[]): GlobalAgentPool {
  const agentsById = new Map<string, GlobalAgentRuntimeState>();

  for (const input of inputs) {
    for (const agent of Object.values(input.agents)) {
      const existing = agentsById.get(agent.agent_id);
      const activeGlobalTaskIds = agent.active_task_ids.map((taskId) =>
        createGlobalTaskId(input.project_id, input.workflow_id, taskId)
      );

      if (!existing) {
        agentsById.set(agent.agent_id, {
          ...agent,
          capabilities: uniqueSorted(agent.capabilities),
          active_task_ids: [...agent.active_task_ids],
          project_ids: [input.project_id],
          workflow_ids: [input.workflow_id],
          active_global_task_ids: activeGlobalTaskIds,
          capacity_remaining: getCapacityRemaining(agent.status, agent.max_concurrent_tasks, activeGlobalTaskIds.length)
        });
        continue;
      }

      const activeTaskIds = [...existing.active_task_ids, ...agent.active_task_ids];
      const activeGlobalIds = [...existing.active_global_task_ids, ...activeGlobalTaskIds];
      const maxConcurrentTasks = existing.max_concurrent_tasks + agent.max_concurrent_tasks;
      const status = deriveMergedStatus(existing.status, agent.status, activeGlobalIds.length, maxConcurrentTasks);

      agentsById.set(agent.agent_id, {
        ...existing,
        capabilities: uniqueSorted([...existing.capabilities, ...agent.capabilities]),
        active_task_ids: activeTaskIds,
        max_concurrent_tasks: maxConcurrentTasks,
        session_id: existing.session_id ?? agent.session_id,
        status,
        project_ids: uniqueSorted([...existing.project_ids, input.project_id]),
        workflow_ids: uniqueSorted([...existing.workflow_ids, input.workflow_id]),
        active_global_task_ids: activeGlobalIds,
        capacity_remaining: getCapacityRemaining(status, maxConcurrentTasks, activeGlobalIds.length)
      });
    }
  }

  const agents = [...agentsById.values()].sort((a, b) => a.agent_id.localeCompare(b.agent_id));
  return {
    agents,
    totals: {
      total_agents: agents.length,
      online_agents: agents.filter((agent) => agent.status !== "offline").length,
      offline_agents: agents.filter((agent) => agent.status === "offline").length,
      max_concurrent_tasks: agents.reduce((sum, agent) => sum + agent.max_concurrent_tasks, 0),
      active_global_task_count: agents.reduce((sum, agent) => sum + agent.active_global_task_ids.length, 0),
      capacity_remaining: agents.reduce((sum, agent) => sum + agent.capacity_remaining, 0)
    }
  };
}

function getCapacityRemaining(
  status: AgentRuntimeState["status"],
  maxConcurrentTasks: number,
  activeTaskCount: number
): number {
  if (status === "offline") {
    return 0;
  }

  return Math.max(0, maxConcurrentTasks - activeTaskCount);
}

export function canGlobalAgentRunTask(agent: GlobalAgentRuntimeState, item: Pick<GlobalTaskQueueItem, "required_capabilities">): boolean {
  if (agent.status === "offline") {
    return false;
  }

  if (agent.capacity_remaining <= 0) {
    return false;
  }

  return item.required_capabilities.every((capability) => agent.capabilities.includes(capability));
}

function deriveMergedStatus(
  left: AgentRuntimeState["status"],
  right: AgentRuntimeState["status"],
  activeTaskCount: number,
  maxConcurrentTasks: number
): AgentRuntimeState["status"] {
  if (left === "offline" && right === "offline") {
    return "offline";
  }

  if (activeTaskCount >= maxConcurrentTasks || left === "busy" || right === "busy") {
    return "busy";
  }

  return "idle";
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}
