import type { PlanTaskInput } from "./task.js";

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
}

export interface TaskDagPlan {
  plan_id: string;
  plan_type: "dag";
  execution_policy: Partial<ExecutionPolicy>;
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
  ack_timeout_seconds: 60
};
