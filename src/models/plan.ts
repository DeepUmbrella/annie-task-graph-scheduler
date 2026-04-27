import type { PlanTaskInput } from "./task.js";

export interface SchedulingPolicy {
  selection_order: "topological" | "risk_aware";
  prefer_low_risk_first: boolean;
  explain_skipped_tasks: boolean;
}

export interface AgentPolicy {
  max_tasks_per_agent: number;
  respect_preferred_agent: boolean;
  fallback_agent: string;
}

export interface RiskScoringWeights {
  explicit_risk: number;
  expected_files_count: number;
  missing_expected_files: number;
  retry_count: number;
  preferred_agent_missing: number;
}

export interface RiskPolicy {
  high_risk_parallel_limit: number;
  critical_requires_review: boolean;
  scoring_weights: RiskScoringWeights;
}

export interface RetryPolicy {
  max_retries: number;
  retry_on: string[];
  manual_review_on_second_failure: boolean;
  backoff: "none" | "linear" | "exponential";
}

export interface ConflictPolicy {
  mode: "exact" | "directory" | "glob";
  directory_conflict_depth: number;
  unknown_files_policy: "allow" | "serialize" | "require_review";
}

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends Array<infer U>
    ? U[]
    : T[K] extends object
      ? DeepPartial<T[K]>
      : T[K];
};

export interface ExecutionPolicy {
  max_parallel_tasks: number;
  max_agents: number;
  same_file_conflict_policy: "serialize";
  review_after_each_wave: boolean;
  stop_on_critical_failure: boolean;
  max_retries: number;
  retry_on: string[];
  manual_review_on_second_failure: boolean;
  requires_ack_default: boolean;
  max_delivery_retries: number;
  ack_timeout_seconds: number;
  scheduling: SchedulingPolicy;
  agents: AgentPolicy;
  risk: RiskPolicy;
  retry: RetryPolicy;
  conflicts: ConflictPolicy;
}

export type ExecutionPolicyInput = DeepPartial<ExecutionPolicy>;

export interface TaskDagPlan {
  plan_id: string;
  plan_type: "dag";
  execution_policy: ExecutionPolicyInput;
  tasks: PlanTaskInput[];
}

export const defaultExecutionPolicy: ExecutionPolicy = {
  max_parallel_tasks: 3,
  max_agents: 3,
  same_file_conflict_policy: "serialize",
  review_after_each_wave: true,
  stop_on_critical_failure: true,
  max_retries: 1,
  retry_on: ["transient"],
  manual_review_on_second_failure: true,
  requires_ack_default: true,
  max_delivery_retries: 2,
  ack_timeout_seconds: 60,
  scheduling: {
    selection_order: "topological",
    prefer_low_risk_first: false,
    explain_skipped_tasks: true
  },
  agents: {
    max_tasks_per_agent: 1,
    respect_preferred_agent: true,
    fallback_agent: "default-agent"
  },
  risk: {
    high_risk_parallel_limit: 1,
    critical_requires_review: true,
    scoring_weights: {
      explicit_risk: 10,
      expected_files_count: 1,
      missing_expected_files: 5,
      retry_count: 3,
      preferred_agent_missing: 2
    }
  },
  retry: {
    max_retries: 1,
    retry_on: ["transient"],
    manual_review_on_second_failure: true,
    backoff: "none"
  },
  conflicts: {
    mode: "exact",
    directory_conflict_depth: 1,
    unknown_files_policy: "allow"
  }
};
