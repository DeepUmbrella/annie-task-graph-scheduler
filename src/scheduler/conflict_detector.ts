import type { Task } from "../models/task.js";

export interface FileConflict {
  file: string;
  task_ids: string[];
}

export function detectFileConflicts(tasks: Task[]): FileConflict[] {
  const fileOwners = new Map<string, string[]>();

  for (const task of tasks) {
    for (const file of task.expected_files) {
      const owners = fileOwners.get(file) ?? [];
      owners.push(task.id);
      fileOwners.set(file, owners);
    }
  }

  return [...fileOwners.entries()]
    .filter(([, taskIds]) => taskIds.length > 1)
    .map(([file, taskIds]) => ({
      file,
      task_ids: taskIds
    }));
}

export function hasFileConflict(candidate: Task, selectedTasks: Task[]): boolean {
  if (candidate.expected_files.length === 0 || selectedTasks.length === 0) {
    return false;
  }

  const selectedFiles = new Set(selectedTasks.flatMap((task) => task.expected_files));
  return candidate.expected_files.some((file) => selectedFiles.has(file));
}
