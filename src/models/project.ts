import type { TaskRisk } from "./task.js";
import type { AgentRuntimeState } from "./workflow.js";

export const projectPriorities = ["low", "normal", "high", "urgent"] as const;

export type ProjectPriority = (typeof projectPriorities)[number];

export const userPriorities = ["background", "normal", "focus", "urgent"] as const;

export type UserPriority = (typeof userPriorities)[number];

export interface ProjectRef {
  project_id: string;
  name: string;
  root_path: string;
  priority: ProjectPriority;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface ProjectWorkflowRef {
  project_id: string;
  workflow_id: string;
  plan_id: string;
  state_path: string;
  status: "pending" | "running" | "reviewing" | "done" | "failed" | "blocked";
  priority: UserPriority;
  registered_at: string;
  updated_at: string;
}

export interface GlobalTaskQueueItem {
  id: string;
  project_id: string;
  project_name: string;
  workflow_id: string;
  plan_id: string;
  task_id: string;
  title: string;
  status: "ready";
  project_priority: ProjectPriority;
  user_priority: UserPriority;
  risk: TaskRisk;
  expected_files: string[];
  required_capabilities: string[];
  preferred_agent: string | null;
  retry_count: number;
  created_at: string;
}

export interface GlobalAgentRuntimeState extends AgentRuntimeState {
  project_ids: string[];
  workflow_ids: string[];
  active_global_task_ids: string[];
  capacity_remaining: number;
}

export interface ProjectRegistrySnapshot {
  version: 1;
  projects: ProjectRef[];
  workflows: ProjectWorkflowRef[];
  updated_at: string | null;
}
