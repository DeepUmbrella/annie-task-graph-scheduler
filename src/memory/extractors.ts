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
