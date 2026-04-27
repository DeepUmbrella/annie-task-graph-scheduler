import type { RetryPolicy } from "../models/plan.js";
import type { Task } from "../models/task.js";

export interface RetryDecision {
  should_retry: boolean;
  next_retry_count: number;
  reason: string;
}

export function decideRetry(
  task: Task,
  failureType: string,
  policy: RetryPolicy
): RetryDecision {
  if (!policy.retry_on.includes(failureType)) {
    return {
      should_retry: false,
      next_retry_count: task.retry_count,
      reason: `Failure type ${failureType} is not retryable.`
    };
  }

  if (task.retry_count >= policy.max_retries) {
    return {
      should_retry: false,
      next_retry_count: task.retry_count,
      reason: `Retry limit ${policy.max_retries} has been reached.`
    };
  }

  return {
    should_retry: true,
    next_retry_count: task.retry_count + 1,
    reason: `Failure type ${failureType} is retryable.`
  };
}
