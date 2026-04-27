import type { GlobalAgentRuntimeState, GlobalTaskQueueItem } from "../models/project.js";

export interface CrossProjectSchedulerOptions {
  max_dispatches?: number;
}

export interface CrossProjectDispatchPlan {
  assignments: CrossProjectAssignment[];
  skipped: CrossProjectSkippedTask[];
  decision: CrossProjectDecision;
}

export interface CrossProjectAssignment {
  global_task_id: string;
  project_id: string;
  workflow_id: string;
  task_id: string;
  assigned_to: string;
  decision: string;
  priority_score: number;
  risk_score: number;
}

export interface CrossProjectSkippedTask {
  global_task_id: string;
  project_id: string;
  workflow_id: string;
  task_id: string;
  reason: string;
  category: "agent_capacity" | "dispatch_limit";
}

export interface CrossProjectDecision {
  ordered_task_ids: string[];
  policy_applied: {
    user_priority_order: string[];
    project_priority_order: string[];
    risk_order: "low_score_first";
    agent_load_order: "least_loaded_first";
    max_dispatches: number | null;
  };
  agent_load_summary: Array<{
    agent_id: string;
    active_global_task_count: number;
    planned_task_count: number;
    max_concurrent_tasks: number;
    capacity_remaining: number;
    status: string;
  }>;
}

const projectPriorityRank: Record<GlobalTaskQueueItem["project_priority"], number> = {
  urgent: 4,
  high: 3,
  normal: 2,
  low: 1
};

const userPriorityRank: Record<GlobalTaskQueueItem["user_priority"], number> = {
  urgent: 4,
  focus: 3,
  normal: 2,
  background: 1
};

export function planCrossProjectDispatch(
  queue: GlobalTaskQueueItem[],
  agents: GlobalAgentRuntimeState[],
  options: CrossProjectSchedulerOptions = {}
): CrossProjectDispatchPlan {
  const agentPlans = new Map(agents.map((agent) => [agent.agent_id, cloneAgentPlan(agent)]));
  const orderedQueue = sortDispatchCandidates(queue, agentPlans);
  const assignments: CrossProjectAssignment[] = [];
  const skipped: CrossProjectSkippedTask[] = [];

  for (const item of orderedQueue) {
    if (options.max_dispatches !== undefined && assignments.length >= options.max_dispatches) {
      skipped.push({
        global_task_id: item.id,
        project_id: item.project_id,
        workflow_id: item.workflow_id,
        task_id: item.task_id,
        reason: `Skipped because max_dispatches=${options.max_dispatches} has been reached.`,
        category: "dispatch_limit"
      });
      continue;
    }

    const selectedAgent = selectAgent(item, agentPlans);
    if (!selectedAgent) {
      skipped.push({
        global_task_id: item.id,
        project_id: item.project_id,
        workflow_id: item.workflow_id,
        task_id: item.task_id,
        reason: "Skipped because no online capable agent has remaining capacity.",
        category: "agent_capacity"
      });
      continue;
    }

    selectedAgent.planned_global_task_ids.push(item.id);
    assignments.push({
      global_task_id: item.id,
      project_id: item.project_id,
      workflow_id: item.workflow_id,
      task_id: item.task_id,
      assigned_to: selectedAgent.agent_id,
      decision: item.preferred_agent === selectedAgent.agent_id ? "preferred_agent_available" : "least_loaded_capable_agent",
      priority_score: getPriorityScore(item),
      risk_score: item.risk_score
    });
  }

  return {
    assignments,
    skipped,
    decision: {
      ordered_task_ids: orderedQueue.map((item) => item.id),
      policy_applied: {
        user_priority_order: ["urgent", "focus", "normal", "background"],
        project_priority_order: ["urgent", "high", "normal", "low"],
        risk_order: "low_score_first",
        agent_load_order: "least_loaded_first",
        max_dispatches: options.max_dispatches ?? null
      },
      agent_load_summary: [...agentPlans.values()]
        .sort((a, b) => a.agent_id.localeCompare(b.agent_id))
        .map((agent) => ({
          agent_id: agent.agent_id,
          active_global_task_count: agent.active_global_task_ids.length,
          planned_task_count: agent.planned_global_task_ids.length,
          max_concurrent_tasks: agent.max_concurrent_tasks,
          capacity_remaining: getCapacityRemaining(agent),
          status: agent.status
        }))
    }
  };
}

interface AgentPlan extends GlobalAgentRuntimeState {
  planned_global_task_ids: string[];
}

function sortDispatchCandidates(
  queue: GlobalTaskQueueItem[],
  agents: Map<string, AgentPlan>
): GlobalTaskQueueItem[] {
  return [...queue].sort((left, right) => {
    const userPriorityComparison = userPriorityRank[right.user_priority] - userPriorityRank[left.user_priority];
    if (userPriorityComparison !== 0) {
      return userPriorityComparison;
    }

    const projectPriorityComparison = projectPriorityRank[right.project_priority] - projectPriorityRank[left.project_priority];
    if (projectPriorityComparison !== 0) {
      return projectPriorityComparison;
    }

    const riskComparison = left.risk_score - right.risk_score;
    if (riskComparison !== 0) {
      return riskComparison;
    }

    const loadComparison = getBestAgentLoad(left, agents) - getBestAgentLoad(right, agents);
    if (loadComparison !== 0) {
      return loadComparison;
    }

    return left.id.localeCompare(right.id);
  });
}

function selectAgent(item: GlobalTaskQueueItem, agents: Map<string, AgentPlan>): AgentPlan | null {
  if (item.preferred_agent) {
    const preferredAgent = agents.get(item.preferred_agent);
    if (preferredAgent && canRunTask(preferredAgent, item)) {
      return preferredAgent;
    }
  }

  return [...agents.values()]
    .filter((agent) => canRunTask(agent, item))
    .sort((left, right) => {
      const loadComparison = getCurrentLoad(left) - getCurrentLoad(right);
      return loadComparison === 0 ? left.agent_id.localeCompare(right.agent_id) : loadComparison;
    })[0] ?? null;
}

function canRunTask(agent: AgentPlan, item: GlobalTaskQueueItem): boolean {
  if (agent.status === "offline") {
    return false;
  }

  if (getCapacityRemaining(agent) <= 0) {
    return false;
  }

  return item.required_capabilities.every((capability) => agent.capabilities.includes(capability));
}

function getBestAgentLoad(item: GlobalTaskQueueItem, agents: Map<string, AgentPlan>): number {
  const selectedAgent = selectAgent(item, agents);
  return selectedAgent ? getCurrentLoad(selectedAgent) : Number.POSITIVE_INFINITY;
}

function getCurrentLoad(agent: AgentPlan): number {
  return agent.active_global_task_ids.length + agent.planned_global_task_ids.length;
}

function getCapacityRemaining(agent: AgentPlan): number {
  return Math.max(0, agent.max_concurrent_tasks - getCurrentLoad(agent));
}

function getPriorityScore(item: GlobalTaskQueueItem): number {
  return userPriorityRank[item.user_priority] * 100 + projectPriorityRank[item.project_priority] * 10;
}

function cloneAgentPlan(agent: GlobalAgentRuntimeState): AgentPlan {
  return {
    ...agent,
    capabilities: [...agent.capabilities],
    active_task_ids: [...agent.active_task_ids],
    project_ids: [...agent.project_ids],
    workflow_ids: [...agent.workflow_ids],
    active_global_task_ids: [...agent.active_global_task_ids],
    planned_global_task_ids: []
  };
}
