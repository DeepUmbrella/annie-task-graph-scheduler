import type { AuditEvent } from "../models/audit.js";
import type { Task } from "../models/task.js";
import type { Wave } from "../models/wave.js";
import type { AgentRuntimeState, WorkflowState } from "../models/workflow.js";
import { TaskGraphSchedulerError } from "../errors.js";

export interface WorkerAssignment {
  task_id: string;
  assigned_to: string;
  decision: string;
}

export interface WorkerAssignmentResult {
  state: WorkflowState;
  assignments: WorkerAssignment[];
  audit_events: AuditEvent[];
}

export interface WorkerPoolOptions {
  now?: string;
  default_agent?: string;
}

export function assignWorkers(
  state: WorkflowState,
  wave: Wave,
  options: WorkerPoolOptions = {}
): WorkerAssignmentResult {
  const now = options.now ?? new Date().toISOString();
  const defaultAgent = options.default_agent ?? state.execution_policy.agents.fallback_agent;
  const tasks = { ...state.tasks };
  const agents = cloneAgents(state.agents);
  const assignments: WorkerAssignment[] = [];
  const auditEvents: AuditEvent[] = [];

  for (const taskId of wave.tasks) {
    const task = tasks[taskId];

    if (!task) {
      throw new TaskGraphSchedulerError("Wave references a missing task.", "WAVE_TASK_NOT_FOUND", {
        workflow_id: state.workflow_id,
        wave_id: wave.id,
        task_id: taskId
      });
    }

    if (task.status !== "ready") {
      throw new TaskGraphSchedulerError("Only ready tasks can be assigned to workers.", "TASK_NOT_READY_FOR_ASSIGNMENT", {
        workflow_id: state.workflow_id,
        wave_id: wave.id,
        task_id: taskId,
        status: task.status
      });
    }

    const selectedAgent = selectAgent(task, agents, {
      defaultAgent,
      respectPreferredAgent: state.execution_policy.agents.respect_preferred_agent,
      maxTasksPerAgent: state.execution_policy.agents.max_tasks_per_agent
    });

    if (!selectedAgent) {
      throw new TaskGraphSchedulerError("No available agent can run this task.", "NO_AVAILABLE_AGENT", {
        workflow_id: state.workflow_id,
        wave_id: wave.id,
        task_id: taskId,
        preferred_agent: task.preferred_agent,
        required_capabilities: task.required_capabilities
      });
    }

    agents[selectedAgent.agent_id] = {
      ...selectedAgent.agent,
      active_task_ids: [...selectedAgent.agent.active_task_ids, taskId],
      status: selectedAgent.agent.active_task_ids.length + 1 >= selectedAgent.agent.max_concurrent_tasks ? "busy" : selectedAgent.agent.status
    };

    const assignedTo = selectedAgent.agent_id;
    tasks[taskId] = {
      ...task,
      status: "running",
      assigned_to: assignedTo,
      started_at: now
    };
    assignments.push({
      task_id: taskId,
      assigned_to: assignedTo,
      decision: selectedAgent.decision
    });
    auditEvents.push(createAuditEvent(state.workflow_id, "WORKER_ASSIGNED", now, {
      task_id: taskId,
      wave_id: wave.id,
      assigned_to: assignedTo,
      decision: selectedAgent.decision,
      active_task_count: agents[selectedAgent.agent_id].active_task_ids.length,
      max_concurrent_tasks: agents[selectedAgent.agent_id].max_concurrent_tasks
    }));
    auditEvents.push(createAuditEvent(state.workflow_id, "TASK_STATUS_CHANGED", now, {
      task_id: taskId,
      from: "ready",
      to: "running"
    }));
  }

  const nextWave: Wave = {
    ...wave,
    status: "running",
    started_at: wave.started_at ?? now
  };
  const existingWave = state.waves.find((candidate) => candidate.id === wave.id);
  const waves = existingWave
    ? state.waves.map((candidate) => candidate.id === wave.id ? nextWave : candidate)
    : [...state.waves, nextWave];

  return {
    state: {
      ...state,
      status: "running",
      current_wave: wave.id,
      tasks,
      agents,
      waves,
      updated_at: now
    },
    assignments,
    audit_events: auditEvents
  };
}

interface AgentSelectionOptions {
  defaultAgent: string;
  respectPreferredAgent: boolean;
  maxTasksPerAgent: number;
}

interface AgentSelection {
  agent_id: string;
  agent: AgentRuntimeState;
  decision: string;
}

function selectAgent(
  task: Task,
  agents: Record<string, AgentRuntimeState>,
  options: AgentSelectionOptions
): AgentSelection | null {
  if (options.respectPreferredAgent && task.preferred_agent) {
    const preferredAgent = ensureAgent(agents, task.preferred_agent, options.maxTasksPerAgent);

    if (canRunTask(preferredAgent, task)) {
      return {
        agent_id: preferredAgent.agent_id,
        agent: preferredAgent,
        decision: "preferred_agent_available"
      };
    }
  }

  const capableAgents = Object.values(agents)
    .filter((agent) => canRunTask(agent, task))
    .sort((left, right) => left.active_task_ids.length - right.active_task_ids.length);

  if (capableAgents[0]) {
    return {
      agent_id: capableAgents[0].agent_id,
      agent: capableAgents[0],
      decision: "least_loaded_capable_agent"
    };
  }

  const fallbackAgent = ensureAgent(agents, options.defaultAgent, options.maxTasksPerAgent);

  if (canRunTask(fallbackAgent, task, { ignoreCapabilities: task.required_capabilities.length === 0 })) {
    return {
      agent_id: fallbackAgent.agent_id,
      agent: fallbackAgent,
      decision: "fallback_agent"
    };
  }

  return null;
}

function canRunTask(
  agent: AgentRuntimeState,
  task: Task,
  options: { ignoreCapabilities?: boolean } = {}
): boolean {
  if (agent.status === "offline") {
    return false;
  }

  if (agent.active_task_ids.length >= agent.max_concurrent_tasks) {
    return false;
  }

  if (options.ignoreCapabilities) {
    return true;
  }

  return task.required_capabilities.every((capability) => agent.capabilities.includes(capability));
}

function ensureAgent(
  agents: Record<string, AgentRuntimeState>,
  agentId: string,
  maxConcurrentTasks: number
): AgentRuntimeState {
  agents[agentId] ??= {
    agent_id: agentId,
    capabilities: [],
    active_task_ids: [],
    max_concurrent_tasks: maxConcurrentTasks,
    session_id: null,
    status: "idle"
  };

  return agents[agentId];
}

function cloneAgents(agents: Record<string, AgentRuntimeState>): Record<string, AgentRuntimeState> {
  return Object.fromEntries(
    Object.entries(agents).map(([agentId, agent]) => [
      agentId,
      {
        ...agent,
        active_task_ids: [...agent.active_task_ids],
        capabilities: [...agent.capabilities]
      }
    ])
  );
}

function createAuditEvent(
  workflowId: string,
  type: string,
  now: string,
  payload: Record<string, unknown>
): AuditEvent {
  return {
    event_id: `evt_${Date.parse(now)}_${Math.random().toString(36).slice(2, 10)}`,
    workflow_id: workflowId,
    type,
    payload,
    created_at: now
  };
}
