import type { Task } from "../models/task.js";
import type { Wave } from "../models/wave.js";
import type { WorkflowState } from "../models/workflow.js";
import { getFileConflictReason } from "./conflict_detector.js";
import { isHighRiskScore, scoreTaskRisk, type RiskScore } from "./risk_scorer.js";

export interface NextWaveResult {
  wave: Wave | null;
  ready_task_ids: string[];
  skipped_ready_tasks: Array<{ task_id: string; reason: string }>;
  risk_scores: Record<string, RiskScore>;
  decision: WaveDecision;
}

export interface WaveDecision {
  selected_tasks: string[];
  skipped_tasks: Array<{ task_id: string; reason: string; category: string }>;
  policy_applied: {
    selection_order: string;
    max_parallel_tasks: number;
    max_agents: number;
    high_risk_parallel_limit: number;
    conflict_mode: string;
  };
  risk_summary: Array<{ task_id: string; score: number; level: string }>;
  agent_load_summary: Array<{ agent_id: string; active_task_count: number; max_concurrent_tasks: number; status: string }>;
  conflict_summary: Array<{ task_id: string; reason: string }>;
}

export function generateNextWave(state: WorkflowState): NextWaveResult {
  const riskScores = Object.fromEntries(
    Object.values(state.tasks).map((task) => [task.id, scoreTaskRisk(task, state.execution_policy.risk)])
  );
  const readyTasks = sortReadyTasks(
    Object.values(state.tasks).filter((task) => task.status === "ready"),
    riskScores,
    state
  );
  const selectedTasks: Task[] = [];
  const skippedReadyTasks: Array<{ task_id: string; reason: string; category: string }> = [];
  const agentKeys = new Set<string>();

  for (const task of readyTasks) {
    const skipDecision = getSkipDecision(task, selectedTasks, agentKeys, state, riskScores);

    if (skipDecision) {
      skippedReadyTasks.push({
        task_id: task.id,
        reason: skipDecision.reason,
        category: skipDecision.category
      });
      continue;
    }

    selectedTasks.push(task);
    agentKeys.add(getAgentKey(task));
  }

  const decision = createWaveDecision(selectedTasks, skippedReadyTasks, riskScores, state);

  if (selectedTasks.length === 0) {
    return {
      wave: null,
      ready_task_ids: readyTasks.map((task) => task.id),
      skipped_ready_tasks: skippedReadyTasks.map(({ task_id, reason }) => ({ task_id, reason })),
      risk_scores: riskScores,
      decision
    };
  }

  const wave: Wave = {
    id: createNextWaveId(state),
    tasks: selectedTasks.map((task) => task.id),
    status: "pending",
    started_at: null,
    completed_at: null,
    review: null,
    reason: `Selected ${selectedTasks.length} task(s) using ${state.execution_policy.scheduling.selection_order} scheduling, conflict mode ${state.execution_policy.conflicts.mode}, and high-risk limit ${state.execution_policy.risk.high_risk_parallel_limit}.`,
    skipped_ready_tasks: skippedReadyTasks.map(({ task_id, reason }) => ({ task_id, reason }))
  };

  return {
    wave,
    ready_task_ids: readyTasks.map((task) => task.id),
    skipped_ready_tasks: skippedReadyTasks.map(({ task_id, reason }) => ({ task_id, reason })),
    risk_scores: riskScores,
    decision
  };
}

interface SkipDecision {
  reason: string;
  category: string;
}

function getSkipDecision(
  task: Task,
  selectedTasks: Task[],
  agentKeys: Set<string>,
  state: WorkflowState,
  riskScores: Record<string, RiskScore>
): SkipDecision | null {
  if (selectedTasks.length >= state.execution_policy.max_parallel_tasks) {
    return {
      category: "parallel_limit",
      reason: `Skipped because max_parallel_tasks=${state.execution_policy.max_parallel_tasks} has been reached.`
    };
  }

  if (selectedTasks.length > 0 && !task.can_parallel) {
    return {
      category: "parallel_policy",
      reason: "Skipped because task is marked can_parallel=false."
    };
  }

  if (selectedTasks.some((selectedTask) => !selectedTask.can_parallel)) {
    return {
      category: "parallel_policy",
      reason: "Skipped because current wave already contains a non-parallel task."
    };
  }

  const nextAgentKey = getAgentKey(task);
  if (!agentKeys.has(nextAgentKey) && agentKeys.size >= state.execution_policy.max_agents) {
    return {
      category: "agent_limit",
      reason: `Skipped because max_agents=${state.execution_policy.max_agents} has been reached.`
    };
  }

  const fileConflictReason = getFileConflictReason(task, selectedTasks, state.execution_policy.conflicts);
  if (fileConflictReason) {
    return {
      category: "file_conflict",
      reason: fileConflictReason
    };
  }

  if (isHighRiskScore(riskScores[task.id])) {
    const selectedHighRiskCount = selectedTasks.filter((selectedTask) =>
      isHighRiskScore(riskScores[selectedTask.id])
    ).length;

    if (selectedHighRiskCount >= state.execution_policy.risk.high_risk_parallel_limit) {
      return {
        category: "risk_limit",
        reason: `Skipped because risk score ${riskScores[task.id].score} exceeds high-risk parallel limit ${state.execution_policy.risk.high_risk_parallel_limit}.`
      };
    }
  }

  return null;
}

function createWaveDecision(
  selectedTasks: Task[],
  skippedTasks: Array<{ task_id: string; reason: string; category: string }>,
  riskScores: Record<string, RiskScore>,
  state: WorkflowState
): WaveDecision {
  return {
    selected_tasks: selectedTasks.map((task) => task.id),
    skipped_tasks: skippedTasks,
    policy_applied: {
      selection_order: state.execution_policy.scheduling.selection_order,
      max_parallel_tasks: state.execution_policy.max_parallel_tasks,
      max_agents: state.execution_policy.max_agents,
      high_risk_parallel_limit: state.execution_policy.risk.high_risk_parallel_limit,
      conflict_mode: state.execution_policy.conflicts.mode
    },
    risk_summary: selectedTasks.map((task) => ({
      task_id: task.id,
      score: riskScores[task.id].score,
      level: riskScores[task.id].level
    })),
    agent_load_summary: Object.values(state.agents).map((agent) => ({
      agent_id: agent.agent_id,
      active_task_count: agent.active_task_ids.length,
      max_concurrent_tasks: agent.max_concurrent_tasks,
      status: agent.status
    })),
    conflict_summary: skippedTasks
      .filter((task) => task.category === "file_conflict")
      .map(({ task_id, reason }) => ({ task_id, reason }))
  };
}

function sortReadyTasks(
  tasks: Task[],
  riskScores: Record<string, RiskScore>,
  state: WorkflowState
): Task[] {
  if (
    state.execution_policy.scheduling.selection_order !== "risk_aware"
    && !state.execution_policy.scheduling.prefer_low_risk_first
  ) {
    return tasks;
  }

  return [...tasks].sort((left, right) => riskScores[left.id].score - riskScores[right.id].score);
}

function getAgentKey(task: Task): string {
  return task.preferred_agent ?? "__default_agent__";
}

function createNextWaveId(state: WorkflowState): string {
  return `wave_${String(state.waves.length + 1).padStart(3, "0")}`;
}
