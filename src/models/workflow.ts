import type { ExecutionPolicy } from "./plan.js";
import type { Task } from "./task.js";
import type { Wave } from "./wave.js";

export interface AgentRuntimeState {
  agent_id: string;
  capabilities: string[];
  active_task_ids: string[];
  max_concurrent_tasks: number;
  session_id: string | null;
  status: "idle" | "busy" | "offline";
}

export interface WorkflowState {
  workflow_id: string;
  plan_id: string;
  current_wave: string | null;
  status: "pending" | "running" | "reviewing" | "done" | "failed" | "blocked";
  execution_policy: ExecutionPolicy;
  tasks: Record<string, Task>;
  waves: Wave[];
  agents: Record<string, AgentRuntimeState>;
  created_at: string;
  updated_at: string;
}
