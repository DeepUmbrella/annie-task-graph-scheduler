import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { TaskGraphSchedulerError } from "../errors.js";
import {
  emptyRuntimeDiscoverySnapshot,
  normalizeRuntimeDiscoverySnapshot,
  sortCandidateNodes,
  sortRuntimeCandidates,
  type CandidateNode,
  type RuntimeCandidate,
  type RuntimeDiscoveryInput,
  type RuntimeDiscoverySnapshot
} from "./model.js";

export interface RuntimeDiscoveryStore {
  snapshotPath(): string;
  saveDiscovery(input: RuntimeDiscoveryInput, options?: RuntimeDiscoveryWriteOptions): Promise<RuntimeDiscoverySnapshot>;
  listRuntimes(): Promise<RuntimeCandidate[]>;
  listCandidates(): Promise<CandidateNode[]>;
  loadSnapshot(): Promise<RuntimeDiscoverySnapshot>;
}

export interface RuntimeDiscoveryWriteOptions {
  now?: string;
}

export function createRuntimeDiscoveryStore(rootDir = ".annie"): RuntimeDiscoveryStore {
  return new FileRuntimeDiscoveryStore(rootDir);
}

class FileRuntimeDiscoveryStore implements RuntimeDiscoveryStore {
  constructor(private readonly rootDir: string) {}

  snapshotPath(): string {
    return join(this.rootDir, "discovery", "runtime-candidates.json");
  }

  async saveDiscovery(
    input: RuntimeDiscoveryInput,
    options: RuntimeDiscoveryWriteOptions = {}
  ): Promise<RuntimeDiscoverySnapshot> {
    const snapshot = normalizeRuntimeDiscoverySnapshot(input, options.now ?? new Date().toISOString());
    await this.saveSnapshot(snapshot);
    return snapshot;
  }

  async listRuntimes(): Promise<RuntimeCandidate[]> {
    const snapshot = await this.loadSnapshot();
    return sortRuntimeCandidates(snapshot.runtimes);
  }

  async listCandidates(): Promise<CandidateNode[]> {
    const snapshot = await this.loadSnapshot();
    return sortCandidateNodes(snapshot.candidates);
  }

  async loadSnapshot(): Promise<RuntimeDiscoverySnapshot> {
    try {
      const raw = await readFile(this.snapshotPath(), "utf8");
      const parsed = JSON.parse(raw) as RuntimeDiscoverySnapshot;

      return {
        version: 1,
        runtimes: sortRuntimeCandidates(parsed.runtimes ?? []),
        candidates: sortCandidateNodes(parsed.candidates ?? []),
        updated_at: parsed.updated_at ?? null
      };
    } catch (error) {
      if (isNotFoundError(error)) {
        return emptyRuntimeDiscoverySnapshot();
      }

      throw new TaskGraphSchedulerError("Failed to load runtime discovery snapshot.", "RUNTIME_DISCOVERY_LOAD_FAILED", {
        path: this.snapshotPath(),
        cause: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private async saveSnapshot(snapshot: RuntimeDiscoverySnapshot): Promise<void> {
    await mkdir(join(this.rootDir, "discovery"), { recursive: true });

    const snapshotPath = this.snapshotPath();
    const tempPath = `${snapshotPath}.tmp`;
    await writeFile(tempPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
    await rename(tempPath, snapshotPath);
  }
}

function isNotFoundError(error: unknown): boolean {
  return typeof error === "object"
    && error !== null
    && "code" in error
    && (error as { code?: string }).code === "ENOENT";
}
