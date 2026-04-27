import { taskRisks } from "../models/task.js";

export interface DagValidationResult {
  valid: boolean;
  errors: string[];
  topological_order: string[];
}

interface PlanLike {
  plan_id?: unknown;
  plan_type?: unknown;
  execution_policy?: unknown;
  tasks?: unknown;
}

interface TaskLike {
  id?: unknown;
  title?: unknown;
  description?: unknown;
  depends_on?: unknown;
  can_parallel?: unknown;
  risk?: unknown;
  expected_files?: unknown;
  required_capabilities?: unknown;
  preferred_agent?: unknown;
}

export function validateDag(input: unknown): DagValidationResult {
  const errors: string[] = [];

  if (!isRecord(input)) {
    return invalid("Plan must be a JSON object.");
  }

  const plan = input as PlanLike;

  if (!isNonEmptyString(plan.plan_id)) {
    errors.push("plan_id must be a non-empty string.");
  }

  if (plan.plan_type !== "dag") {
    errors.push('plan_type must be "dag".');
  }

  if (plan.execution_policy !== undefined && !isRecord(plan.execution_policy)) {
    errors.push("execution_policy must be an object when provided.");
  }

  if (!Array.isArray(plan.tasks)) {
    errors.push("tasks must be an array.");
    return result(errors, []);
  }

  if (plan.tasks.length === 0) {
    errors.push("tasks must not be empty.");
    return result(errors, []);
  }

  const taskIds = new Set<string>();
  const duplicateIds = new Set<string>();
  const tasks: TaskLike[] = [];

  for (const [index, rawTask] of plan.tasks.entries()) {
    if (!isRecord(rawTask)) {
      errors.push(`tasks[${index}] must be an object.`);
      continue;
    }

    const task = rawTask as TaskLike;
    tasks.push(task);

    if (!isNonEmptyString(task.id)) {
      errors.push(`tasks[${index}].id must be a non-empty string.`);
    } else if (taskIds.has(task.id)) {
      duplicateIds.add(task.id);
    } else {
      taskIds.add(task.id);
    }

    if (!isNonEmptyString(task.title)) {
      errors.push(`tasks[${index}].title must be a non-empty string.`);
    }

    if (task.description !== undefined && typeof task.description !== "string") {
      errors.push(`tasks[${index}].description must be a string when provided.`);
    }

    if (task.depends_on !== undefined && !isStringArray(task.depends_on)) {
      errors.push(`tasks[${index}].depends_on must be an array of strings when provided.`);
    }

    if (task.can_parallel !== undefined && typeof task.can_parallel !== "boolean") {
      errors.push(`tasks[${index}].can_parallel must be a boolean when provided.`);
    }

    if (task.risk !== undefined && !taskRisks.includes(task.risk as never)) {
      errors.push(`tasks[${index}].risk must be one of: ${taskRisks.join(", ")}.`);
    }

    if (task.expected_files !== undefined && !isStringArray(task.expected_files)) {
      errors.push(`tasks[${index}].expected_files must be an array of strings when provided.`);
    }

    if (task.required_capabilities !== undefined && !isStringArray(task.required_capabilities)) {
      errors.push(`tasks[${index}].required_capabilities must be an array of strings when provided.`);
    }

    if (task.preferred_agent !== undefined && task.preferred_agent !== null && typeof task.preferred_agent !== "string") {
      errors.push(`tasks[${index}].preferred_agent must be a string or null when provided.`);
    }
  }

  for (const duplicateId of duplicateIds) {
    errors.push(`Duplicate task id: ${duplicateId}.`);
  }

  if (errors.length > 0) {
    return result(errors, []);
  }

  const graph = new Map<string, string[]>();
  const indegree = new Map<string, number>();

  for (const rawTask of tasks) {
    const id = rawTask.id as string;
    graph.set(id, []);
    indegree.set(id, 0);
  }

  for (const rawTask of tasks) {
    const id = rawTask.id as string;
    const dependsOn = (rawTask.depends_on ?? []) as string[];

    for (const dependencyId of dependsOn) {
      if (!taskIds.has(dependencyId)) {
        errors.push(`Task ${id} depends on missing task ${dependencyId}.`);
        continue;
      }

      graph.get(dependencyId)?.push(id);
      indegree.set(id, (indegree.get(id) ?? 0) + 1);
    }
  }

  if (errors.length > 0) {
    return result(errors, []);
  }

  const topologicalOrder = topologicalSort(tasks.map((task) => task.id as string), graph, indegree);

  if (topologicalOrder.length !== tasks.length) {
    const cycleTasks = findCycleTaskIds(graph);
    errors.push(`Task DAG contains a cycle${cycleTasks.length > 0 ? ` involving: ${cycleTasks.join(" -> ")}` : ""}.`);
  }

  return result(errors, topologicalOrder);
}

function topologicalSort(
  ids: string[],
  graph: Map<string, string[]>,
  indegree: Map<string, number>
): string[] {
  const pending = ids.filter((id) => (indegree.get(id) ?? 0) === 0);
  const order: string[] = [];

  while (pending.length > 0) {
    const id = pending.shift() as string;
    order.push(id);

    for (const downstreamId of graph.get(id) ?? []) {
      const nextIndegree = (indegree.get(downstreamId) ?? 0) - 1;
      indegree.set(downstreamId, nextIndegree);

      if (nextIndegree === 0) {
        pending.push(downstreamId);
      }
    }
  }

  return order;
}

function findCycleTaskIds(graph: Map<string, string[]>): string[] {
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const path: string[] = [];

  for (const id of graph.keys()) {
    const cycle = visit(id, graph, visiting, visited, path);

    if (cycle.length > 0) {
      return cycle;
    }
  }

  return [];
}

function visit(
  id: string,
  graph: Map<string, string[]>,
  visiting: Set<string>,
  visited: Set<string>,
  path: string[]
): string[] {
  if (visited.has(id)) {
    return [];
  }

  if (visiting.has(id)) {
    const cycleStart = path.indexOf(id);
    return [...path.slice(cycleStart), id];
  }

  visiting.add(id);
  path.push(id);

  for (const downstreamId of graph.get(id) ?? []) {
    const cycle = visit(downstreamId, graph, visiting, visited, path);

    if (cycle.length > 0) {
      return cycle;
    }
  }

  path.pop();
  visiting.delete(id);
  visited.add(id);

  return [];
}

function invalid(error: string): DagValidationResult {
  return {
    valid: false,
    errors: [error],
    topological_order: []
  };
}

function result(errors: string[], topologicalOrder: string[]): DagValidationResult {
  return {
    valid: errors.length === 0,
    errors,
    topological_order: errors.length === 0 ? topologicalOrder : []
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}
