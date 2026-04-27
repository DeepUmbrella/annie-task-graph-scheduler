import type { ExecutionPolicyInput } from "./plan.js";
import type { PlanTaskInput } from "./task.js";

export interface TaskTemplate {
  id: string;
  name: string;
  description: string;
  tasks: PlanTaskInput[];
  execution_policy: ExecutionPolicyInput;
  tags: string[];
  version: number;
  created_at: string;
}

export interface TemplateRegistry {
  register(template: TaskTemplate): void;
  get(id: string): TaskTemplate | undefined;
  list(): TaskTemplate[];
  findByTag(tag: string): TaskTemplate[];
}
