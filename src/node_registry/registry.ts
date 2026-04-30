import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { TaskGraphSchedulerError } from "../errors.js";
import {
  emptyNodeRegistrySnapshot,
  normalizeNodeRegistrationProposal,
  sortNodes,
  sortTeams,
  type NodeRegistrationProposal,
  type NodeRegistrySnapshot,
  type RegisteredNode,
  type TeamComposition
} from "./model.js";

export interface NodeRegistry {
  registryPath(): string;
  registerProposal(proposal: NodeRegistrationProposal, options?: NodeRegistryWriteOptions): Promise<NodeRegistrySnapshot>;
  listNodes(): Promise<RegisteredNode[]>;
  listTeams(): Promise<TeamComposition[]>;
  loadSnapshot(): Promise<NodeRegistrySnapshot>;
}

export interface NodeRegistryWriteOptions {
  now?: string;
}

export function createNodeRegistry(rootDir = ".annie"): NodeRegistry {
  return new FileNodeRegistry(rootDir);
}

class FileNodeRegistry implements NodeRegistry {
  constructor(private readonly rootDir: string) {}

  registryPath(): string {
    return join(this.rootDir, "nodes", "registry.json");
  }

  async registerProposal(
    proposal: NodeRegistrationProposal,
    options: NodeRegistryWriteOptions = {}
  ): Promise<NodeRegistrySnapshot> {
    const snapshot = await this.loadSnapshot();
    const now = options.now ?? new Date().toISOString();
    const updated = normalizeNodeRegistrationProposal(proposal, now, snapshot);

    await this.saveSnapshot(updated);

    return updated;
  }

  async listNodes(): Promise<RegisteredNode[]> {
    const snapshot = await this.loadSnapshot();
    return sortNodes(snapshot.nodes);
  }

  async listTeams(): Promise<TeamComposition[]> {
    const snapshot = await this.loadSnapshot();
    return sortTeams(snapshot.team_compositions);
  }

  async loadSnapshot(): Promise<NodeRegistrySnapshot> {
    try {
      const raw = await readFile(this.registryPath(), "utf8");
      const parsed = JSON.parse(raw) as NodeRegistrySnapshot;

      return {
        version: 1,
        nodes: sortNodes(parsed.nodes ?? []),
        team_compositions: sortTeams(parsed.team_compositions ?? []),
        updated_at: parsed.updated_at ?? null
      };
    } catch (error) {
      if (isNotFoundError(error)) {
        return emptyNodeRegistrySnapshot();
      }

      throw new TaskGraphSchedulerError("Failed to load node registry.", "NODE_REGISTRY_LOAD_FAILED", {
        path: this.registryPath(),
        cause: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private async saveSnapshot(snapshot: NodeRegistrySnapshot): Promise<void> {
    await mkdir(join(this.rootDir, "nodes"), { recursive: true });

    const registryPath = this.registryPath();
    const tempPath = `${registryPath}.tmp`;
    await writeFile(tempPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
    await rename(tempPath, registryPath);
  }
}

function isNotFoundError(error: unknown): boolean {
  return typeof error === "object"
    && error !== null
    && "code" in error
    && (error as { code?: string }).code === "ENOENT";
}
