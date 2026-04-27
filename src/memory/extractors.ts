import type { MemoryCandidate } from "./model.js";
import type { WorkflowState } from "../models/workflow.js";

export interface MemoryExtractionOptions {
  now?: string;
}

export function extractExecutionMemoryCandidates(
  state: WorkflowState,
  options: MemoryExtractionOptions = {}
): MemoryCandidate[] {
  const now = options.now ?? new Date().toISOString();
  const candidates: MemoryCandidate[] = [];

  for (const wave of state.waves) {
    if (wave.review?.status !== "passed") {
      continue;
    }

    for (const taskId of wave.tasks) {
      const task = state.tasks[taskId];
      if (!task || task.status !== "done") {
        continue;
      }

      candidates.push({
        category: "execution_result",
        title: `Task ${task.id}: ${task.title}`,
        summary: task.result_summary ?? task.title,
        content: {
          task_id: task.id,
          title: task.title,
          description: task.description,
          changed_files: task.changed_files,
          tests_run: task.tests_run,
          risks_found: task.risks_found,
          next_recommendation: task.next_recommendation,
          assigned_to: task.assigned_to,
          risk: task.risk
        },
        confidence: getExecutionConfidence(task),
        reason: "Task is done and its wave passed ReviewGate.",
        tags: createExecutionTags(task),
        provenance: {
          workflow_id: state.workflow_id,
          plan_id: state.plan_id,
          wave_id: wave.id,
          task_id: task.id,
          source: "workflow_state",
          source_key: `${state.workflow_id}:${wave.id}:${task.id}:execution_result`,
          created_at: now
        }
      });
    }
  }

  return candidates.sort((a, b) => a.provenance.source_key.localeCompare(b.provenance.source_key));
}

export function extractPreferenceMemoryCandidates(
  state: WorkflowState,
  options: MemoryExtractionOptions = {}
): MemoryCandidate[] {
  const now = options.now ?? new Date().toISOString();
  const policy = state.execution_policy;
  const skippedReasons = state.waves.flatMap((wave) =>
    wave.skipped_ready_tasks.map((skipped) => ({
      wave_id: wave.id,
      task_id: skipped.task_id,
      reason: skipped.reason
    }))
  );

  const candidates: MemoryCandidate[] = [
    {
      category: "preference",
      title: "Workflow concurrency preference",
      summary: `Use up to ${policy.max_parallel_tasks} parallel task(s) and ${policy.max_agents} agent(s).`,
      content: {
        max_parallel_tasks: policy.max_parallel_tasks,
        max_agents: policy.max_agents,
        max_tasks_per_agent: policy.agents.max_tasks_per_agent,
        respect_preferred_agent: policy.agents.respect_preferred_agent
      },
      confidence: "high",
      reason: "ExecutionPolicy explicitly defines concurrency and agent limits.",
      tags: ["preference", "concurrency", "agents"],
      provenance: createWorkflowPreferenceProvenance(state, "concurrency", now)
    },
    {
      category: "preference",
      title: "Workflow risk scheduling preference",
      summary: `Risk scheduling uses ${policy.scheduling.selection_order} order with high-risk parallel limit ${policy.risk.high_risk_parallel_limit}.`,
      content: {
        selection_order: policy.scheduling.selection_order,
        prefer_low_risk_first: policy.scheduling.prefer_low_risk_first,
        high_risk_parallel_limit: policy.risk.high_risk_parallel_limit,
        critical_requires_review: policy.risk.critical_requires_review
      },
      confidence: policy.scheduling.selection_order === "risk_aware" || policy.scheduling.prefer_low_risk_first ? "high" : "medium",
      reason: "ExecutionPolicy defines risk ordering and high-risk parallel limits.",
      tags: ["preference", "risk", "scheduling"],
      provenance: createWorkflowPreferenceProvenance(state, "risk", now)
    },
    {
      category: "preference",
      title: "Workflow file conflict preference",
      summary: `Conflict detection uses ${policy.conflicts.mode} mode and ${policy.conflicts.unknown_files_policy} unknown-file policy.`,
      content: {
        same_file_conflict_policy: policy.same_file_conflict_policy,
        conflict_mode: policy.conflicts.mode,
        directory_conflict_depth: policy.conflicts.directory_conflict_depth,
        unknown_files_policy: policy.conflicts.unknown_files_policy
      },
      confidence: "high",
      reason: "ExecutionPolicy explicitly defines conflict handling.",
      tags: ["preference", "conflict", "files"],
      provenance: createWorkflowPreferenceProvenance(state, "conflict", now)
    }
  ];

  const skippedReasonCounts = countSkippedReasonSignals(skippedReasons.map((skipped) => skipped.reason));
  for (const [signal, count] of Object.entries(skippedReasonCounts)) {
    if (count === 0) {
      continue;
    }

    candidates.push({
      category: "preference",
      title: `Observed scheduler preference: ${signal}`,
      summary: `Scheduler skipped ${count} task(s) because of ${signal}.`,
      content: {
        signal,
        count,
        skipped: skippedReasons.filter((skipped) => classifySkippedReason(skipped.reason) === signal)
      },
      confidence: count > 1 ? "high" : "medium",
      reason: "Scheduler decisions show this constraint affected task selection.",
      tags: ["preference", "scheduler", signal],
      provenance: createWorkflowPreferenceProvenance(state, `skipped-${signal}`, now)
    });
  }

  return candidates.sort((a, b) => a.provenance.source_key.localeCompare(b.provenance.source_key));
}

function getExecutionConfidence(task: NonNullable<WorkflowState["tasks"][string]>): MemoryCandidate["confidence"] {
  if (task.tests_run.length > 0 && task.risks_found.length === 0) {
    return "high";
  }

  if (task.result_summary) {
    return "medium";
  }

  return "low";
}

function createExecutionTags(task: NonNullable<WorkflowState["tasks"][string]>): string[] {
  return [
    "execution",
    task.risk,
    ...task.required_capabilities,
    ...(task.assigned_to ? [task.assigned_to] : [])
  ].filter((tag, index, tags) => tags.indexOf(tag) === index);
}

function createWorkflowPreferenceProvenance(
  state: WorkflowState,
  key: string,
  now: string
): MemoryCandidate["provenance"] {
  return {
    workflow_id: state.workflow_id,
    plan_id: state.plan_id,
    wave_id: null,
    task_id: null,
    source: "scheduler_decision",
    source_key: `${state.workflow_id}:preference:${key}`,
    created_at: now
  };
}

function countSkippedReasonSignals(reasons: string[]): Record<string, number> {
  const counts: Record<string, number> = {
    conflict: 0,
    risk: 0,
    concurrency: 0,
    agent: 0
  };

  for (const reason of reasons) {
    const signal = classifySkippedReason(reason);
    if (signal) {
      counts[signal] += 1;
    }
  }

  return counts;
}

function classifySkippedReason(reason: string): "conflict" | "risk" | "concurrency" | "agent" | null {
  const normalized = reason.toLowerCase();

  if (normalized.includes("conflict")) {
    return "conflict";
  }

  if (normalized.includes("risk")) {
    return "risk";
  }

  if (normalized.includes("max_parallel") || normalized.includes("parallel")) {
    return "concurrency";
  }

  if (normalized.includes("agent")) {
    return "agent";
  }

  return null;
}
