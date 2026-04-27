import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { TaskGraphSchedulerError } from "../errors.js";
import type {
  ProjectPriority,
  ProjectRef,
  ProjectRegistrySnapshot,
  ProjectWorkflowRef,
  UserPriority
} from "../models/project.js";

export interface ProjectRegistry {
  registryPath(): string;
  registerProject(input: ProjectRegistrationInput, options?: ProjectRegistryWriteOptions): Promise<ProjectRef>;
  getProject(projectId: string): Promise<ProjectRef | null>;
  listProjects(): Promise<ProjectRef[]>;
  updateProject(
    projectId: string,
    updates: ProjectUpdateInput,
    options?: ProjectRegistryWriteOptions
  ): Promise<ProjectRef>;
  registerWorkflow(input: ProjectWorkflowRegistrationInput, options?: ProjectRegistryWriteOptions): Promise<ProjectWorkflowRef>;
  listWorkflows(projectId?: string): Promise<ProjectWorkflowRef[]>;
  loadSnapshot(): Promise<ProjectRegistrySnapshot>;
}

export interface ProjectRegistryWriteOptions {
  now?: string;
}

export interface ProjectRegistrationInput {
  project_id: string;
  name: string;
  root_path: string;
  priority?: ProjectPriority;
  tags?: string[];
}

export interface ProjectUpdateInput {
  name?: string;
  root_path?: string;
  priority?: ProjectPriority;
  tags?: string[];
}

export interface ProjectWorkflowRegistrationInput {
  project_id: string;
  workflow_id: string;
  plan_id: string;
  state_path?: string;
  status?: ProjectWorkflowRef["status"];
  priority?: UserPriority;
}

export function createProjectRegistry(rootDir = ".annie"): ProjectRegistry {
  return new FileProjectRegistry(rootDir);
}

class FileProjectRegistry implements ProjectRegistry {
  constructor(private readonly rootDir: string) {}

  registryPath(): string {
    return join(this.rootDir, "projects.json");
  }

  async registerProject(input: ProjectRegistrationInput, options: ProjectRegistryWriteOptions = {}): Promise<ProjectRef> {
    assertNonEmpty(input.project_id, "project_id");
    assertNonEmpty(input.name, "name");
    assertNonEmpty(input.root_path, "root_path");

    const snapshot = await this.loadSnapshot();
    if (snapshot.projects.some((project) => project.project_id === input.project_id)) {
      throw new TaskGraphSchedulerError("Project already exists.", "PROJECT_ALREADY_EXISTS", {
        project_id: input.project_id
      });
    }

    const now = options.now ?? new Date().toISOString();
    const project: ProjectRef = {
      project_id: input.project_id,
      name: input.name,
      root_path: input.root_path,
      priority: input.priority ?? "normal",
      tags: input.tags ?? [],
      created_at: now,
      updated_at: now
    };

    await this.saveSnapshot({
      ...snapshot,
      projects: sortProjects([...snapshot.projects, project]),
      updated_at: now
    });

    return project;
  }

  async getProject(projectId: string): Promise<ProjectRef | null> {
    const snapshot = await this.loadSnapshot();
    return snapshot.projects.find((project) => project.project_id === projectId) ?? null;
  }

  async listProjects(): Promise<ProjectRef[]> {
    const snapshot = await this.loadSnapshot();
    return sortProjects(snapshot.projects);
  }

  async updateProject(
    projectId: string,
    updates: ProjectUpdateInput,
    options: ProjectRegistryWriteOptions = {}
  ): Promise<ProjectRef> {
    const snapshot = await this.loadSnapshot();
    const existing = snapshot.projects.find((project) => project.project_id === projectId);

    if (!existing) {
      throw new TaskGraphSchedulerError("Project does not exist.", "PROJECT_NOT_FOUND", {
        project_id: projectId
      });
    }

    const now = options.now ?? new Date().toISOString();
    const updated: ProjectRef = {
      ...existing,
      ...updates,
      tags: updates.tags ?? existing.tags,
      updated_at: now
    };

    await this.saveSnapshot({
      ...snapshot,
      projects: sortProjects(snapshot.projects.map((project) => project.project_id === projectId ? updated : project)),
      updated_at: now
    });

    return updated;
  }

  async registerWorkflow(
    input: ProjectWorkflowRegistrationInput,
    options: ProjectRegistryWriteOptions = {}
  ): Promise<ProjectWorkflowRef> {
    assertNonEmpty(input.project_id, "project_id");
    assertNonEmpty(input.workflow_id, "workflow_id");
    assertNonEmpty(input.plan_id, "plan_id");

    const snapshot = await this.loadSnapshot();
    if (!snapshot.projects.some((project) => project.project_id === input.project_id)) {
      throw new TaskGraphSchedulerError("Project does not exist.", "PROJECT_NOT_FOUND", {
        project_id: input.project_id
      });
    }

    if (snapshot.workflows.some((workflow) => workflow.workflow_id === input.workflow_id)) {
      throw new TaskGraphSchedulerError("Workflow already exists in project registry.", "PROJECT_WORKFLOW_ALREADY_EXISTS", {
        workflow_id: input.workflow_id
      });
    }

    const now = options.now ?? new Date().toISOString();
    const workflow: ProjectWorkflowRef = {
      project_id: input.project_id,
      workflow_id: input.workflow_id,
      plan_id: input.plan_id,
      state_path: input.state_path ?? join(this.rootDir, "workflows", input.workflow_id, "state.json"),
      status: input.status ?? "running",
      priority: input.priority ?? "normal",
      registered_at: now,
      updated_at: now
    };

    await this.saveSnapshot({
      ...snapshot,
      workflows: sortWorkflows([...snapshot.workflows, workflow]),
      updated_at: now
    });

    return workflow;
  }

  async listWorkflows(projectId?: string): Promise<ProjectWorkflowRef[]> {
    const snapshot = await this.loadSnapshot();
    const workflows = projectId
      ? snapshot.workflows.filter((workflow) => workflow.project_id === projectId)
      : snapshot.workflows;

    return sortWorkflows(workflows);
  }

  async loadSnapshot(): Promise<ProjectRegistrySnapshot> {
    try {
      const raw = await readFile(this.registryPath(), "utf8");
      const parsed = JSON.parse(raw) as ProjectRegistrySnapshot;
      return {
        version: 1,
        projects: sortProjects(parsed.projects ?? []),
        workflows: sortWorkflows(parsed.workflows ?? []),
        updated_at: parsed.updated_at ?? null
      };
    } catch (error) {
      if (isNotFoundError(error)) {
        return emptySnapshot();
      }

      throw new TaskGraphSchedulerError("Failed to load project registry.", "PROJECT_REGISTRY_LOAD_FAILED", {
        path: this.registryPath(),
        cause: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private async saveSnapshot(snapshot: ProjectRegistrySnapshot): Promise<void> {
    await mkdir(this.rootDir, { recursive: true });

    const registryPath = this.registryPath();
    const tempPath = `${registryPath}.tmp`;
    await writeFile(tempPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
    await rename(tempPath, registryPath);
  }
}

function emptySnapshot(): ProjectRegistrySnapshot {
  return {
    version: 1,
    projects: [],
    workflows: [],
    updated_at: null
  };
}

function assertNonEmpty(value: string, field: string): void {
  if (value.trim().length === 0) {
    throw new TaskGraphSchedulerError("Project registry input is invalid.", "PROJECT_REGISTRY_INPUT_INVALID", {
      field
    });
  }
}

function sortProjects(projects: ProjectRef[]): ProjectRef[] {
  return [...projects].sort((a, b) => a.project_id.localeCompare(b.project_id));
}

function sortWorkflows(workflows: ProjectWorkflowRef[]): ProjectWorkflowRef[] {
  return [...workflows].sort((a, b) => {
    const projectComparison = a.project_id.localeCompare(b.project_id);
    return projectComparison === 0 ? a.workflow_id.localeCompare(b.workflow_id) : projectComparison;
  });
}

function isNotFoundError(error: unknown): boolean {
  return typeof error === "object"
    && error !== null
    && "code" in error
    && (error as { code?: string }).code === "ENOENT";
}
