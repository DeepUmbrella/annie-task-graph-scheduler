import type { RiskPolicy } from "../models/plan.js";
import type { Task, TaskRisk } from "../models/task.js";

export interface RiskScore {
  task_id: string;
  score: number;
  level: TaskRisk;
  reasons: string[];
}

const explicitRiskBase: Record<TaskRisk, number> = {
  low: 1,
  medium: 3,
  high: 7,
  critical: 10
};

export function scoreTaskRisk(task: Task, policy: RiskPolicy): RiskScore {
  const reasons: string[] = [];
  let score = explicitRiskBase[task.risk] * policy.scoring_weights.explicit_risk;
  reasons.push(`explicit risk ${task.risk}`);

  if (task.expected_files.length === 0) {
    score += policy.scoring_weights.missing_expected_files;
    reasons.push("missing expected_files");
  } else {
    score += task.expected_files.length * policy.scoring_weights.expected_files_count;
    reasons.push(`${task.expected_files.length} expected file(s)`);
  }

  if (task.retry_count > 0) {
    score += task.retry_count * policy.scoring_weights.retry_count;
    reasons.push(`${task.retry_count} retry attempt(s)`);
  }

  if (!task.preferred_agent) {
    score += policy.scoring_weights.preferred_agent_missing;
    reasons.push("missing preferred_agent");
  }

  return {
    task_id: task.id,
    score,
    level: task.risk,
    reasons
  };
}

export function isHighRiskScore(score: RiskScore): boolean {
  return score.level === "high" || score.level === "critical";
}
