import type { ConflictPolicy } from "../models/plan.js";
import type { Task } from "../models/task.js";

export interface FileConflict {
  file: string;
  task_ids: string[];
  type: "exact" | "directory" | "glob" | "unknown_files";
}

const defaultConflictPolicy: ConflictPolicy = {
  mode: "exact",
  directory_conflict_depth: 1,
  unknown_files_policy: "allow"
};

export function detectFileConflicts(
  tasks: Task[],
  policy: ConflictPolicy = defaultConflictPolicy
): FileConflict[] {
  const conflicts: FileConflict[] = [];

  for (let leftIndex = 0; leftIndex < tasks.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < tasks.length; rightIndex += 1) {
      const conflict = getTaskFileConflict(tasks[leftIndex], tasks[rightIndex], policy);

      if (conflict) {
        conflicts.push(conflict);
      }
    }
  }

  return conflicts;
}

export function getTaskFileConflict(
  left: Task,
  right: Task,
  policy: ConflictPolicy = defaultConflictPolicy
): FileConflict | null {
  if (left.expected_files.length === 0 || right.expected_files.length === 0) {
    if (policy.unknown_files_policy === "serialize") {
      return {
        file: "<unknown>",
        task_ids: [left.id, right.id],
        type: "unknown_files"
      };
    }

    return null;
  }

  for (const leftFile of left.expected_files) {
    for (const rightFile of right.expected_files) {
      if (leftFile === rightFile) {
        return {
          file: leftFile,
          task_ids: [left.id, right.id],
          type: "exact"
        };
      }

      if (policy.mode === "directory" && sameDirectoryScope(leftFile, rightFile, policy.directory_conflict_depth)) {
        return {
          file: directoryScope(leftFile, policy.directory_conflict_depth),
          task_ids: [left.id, right.id],
          type: "directory"
        };
      }

      if (policy.mode === "glob" && (globMatches(leftFile, rightFile) || globMatches(rightFile, leftFile))) {
        return {
          file: leftFile.includes("*") ? leftFile : rightFile,
          task_ids: [left.id, right.id],
          type: "glob"
        };
      }
    }
  }

  return null;
}

export function hasFileConflict(
  candidate: Task,
  selectedTasks: Task[],
  policy: ConflictPolicy = defaultConflictPolicy
): boolean {
  return selectedTasks.some((selectedTask) => getTaskFileConflict(candidate, selectedTask, policy) !== null);
}

export function getFileConflictReason(
  candidate: Task,
  selectedTasks: Task[],
  policy: ConflictPolicy = defaultConflictPolicy
): string | null {
  const conflict = selectedTasks
    .map((selectedTask) => getTaskFileConflict(candidate, selectedTask, policy))
    .find((item) => item !== null);

  if (!conflict) {
    return null;
  }

  return `Skipped because ${conflict.type} file conflict was predicted for ${conflict.file}.`;
}

function sameDirectoryScope(left: string, right: string, depth: number): boolean {
  return directoryScope(left, depth) === directoryScope(right, depth);
}

function directoryScope(path: string, depth: number): string {
  return path.split("/").slice(0, Math.max(depth, 1)).join("/");
}

function globMatches(pattern: string, value: string): boolean {
  if (!pattern.includes("*")) {
    return false;
  }

  const escaped = pattern
    .split("**")
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^/]*"))
    .join(".*");
  return new RegExp(`^${escaped}$`).test(value);
}
