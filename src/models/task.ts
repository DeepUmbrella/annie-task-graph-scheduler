export const taskStatuses = [
  "pending",
  "ready",
  "running",
  "reviewing",
  "done",
  "failed",
  "blocked",
  "cancelled"
] as const;

export type TaskStatus = (typeof taskStatuses)[number];

export const taskRisks = ["low", "medium", "high", "critical"] as const;

export type TaskRisk = (typeof taskRisks)[number];

export interface Task {
  id: string;
  title: string;
  description: string;
  depends_on: string[];
  status: TaskStatus;
  can_parallel: boolean;
  risk: TaskRisk;
  expected_files: string[];
  changed_files: string[];
  preferred_agent: string | null;
  assigned_to: string | null;
  retry_count: number;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  blocked_reason?: string;
}

export interface PlanTaskInput {
  id: string;
  title: string;
  description?: string;
  depends_on?: string[];
  can_parallel?: boolean;
  risk?: TaskRisk;
  expected_files?: string[];
  preferred_agent?: string | null;
}
