import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { TaskGraphSchedulerError } from "../errors.js";
import type { MemoryAdapter, MemoryCandidate, MemoryCategory, MemoryListFilter, MemoryRecord, MemoryWriteOptions } from "./model.js";

export interface LocalMemoryStore extends MemoryAdapter {
  memoryDir(): string;
  recordsPath(): string;
}

export function createLocalMemoryStore(rootDir = ".annie"): LocalMemoryStore {
  return new JsonlMemoryStore(rootDir);
}

class JsonlMemoryStore implements LocalMemoryStore {
  constructor(private readonly rootDir: string) {}

  memoryDir(): string {
    return join(this.rootDir, "memory");
  }

  recordsPath(): string {
    return join(this.memoryDir(), "records.jsonl");
  }

  async append(candidate: MemoryCandidate, options: MemoryWriteOptions = {}): Promise<MemoryRecord> {
    try {
      const existingRecords = await this.loadRecords();
      const existing = existingRecords.find((record) =>
        record.provenance.source_key === candidate.provenance.source_key
      );

      if (existing) {
        return existing;
      }

      const now = options.now ?? new Date().toISOString();
      const record: MemoryRecord = {
        ...candidate,
        id: createMemoryRecordId(candidate),
        stored_at: now
      };

      await mkdir(this.memoryDir(), { recursive: true });
      await writeFile(this.recordsPath(), `${JSON.stringify(record)}\n`, {
        encoding: "utf8",
        flag: "a"
      });

      return record;
    } catch (error) {
      if (error instanceof TaskGraphSchedulerError) {
        throw error;
      }

      throw new TaskGraphSchedulerError("Failed to append memory record.", "MEMORY_STORE_APPEND_FAILED", {
        path: this.recordsPath(),
        source_key: candidate.provenance.source_key,
        cause: error instanceof Error ? error.message : String(error)
      });
    }
  }

  async list(filter: MemoryListFilter = {}): Promise<MemoryRecord[]> {
    const records = await this.loadRecords();
    return records.filter((record) =>
      (!filter.category || record.category === filter.category)
      && (!filter.tag || record.tags.includes(filter.tag))
      && (!filter.workflow_id || record.provenance.workflow_id === filter.workflow_id)
    );
  }

  async findByCategory(category: MemoryCategory): Promise<MemoryRecord[]> {
    return this.list({ category });
  }

  private async loadRecords(): Promise<MemoryRecord[]> {
    try {
      const raw = await readFile(this.recordsPath(), "utf8");
      return raw
        .split("\n")
        .filter((line) => line.trim().length > 0)
        .map((line, index) => parseRecordLine(line, index + 1, this.recordsPath()));
    } catch (error) {
      if (isNotFoundError(error)) {
        return [];
      }

      if (error instanceof TaskGraphSchedulerError) {
        throw error;
      }

      throw new TaskGraphSchedulerError("Failed to load memory records.", "MEMORY_STORE_LOAD_FAILED", {
        path: this.recordsPath(),
        cause: error instanceof Error ? error.message : String(error)
      });
    }
  }
}

function parseRecordLine(line: string, lineNumber: number, path: string): MemoryRecord {
  try {
    return JSON.parse(line) as MemoryRecord;
  } catch (error) {
    throw new TaskGraphSchedulerError("Failed to parse memory record.", "MEMORY_STORE_RECORD_INVALID", {
      path,
      line: lineNumber,
      cause: error instanceof Error ? error.message : String(error)
    });
  }
}

function createMemoryRecordId(candidate: MemoryCandidate): string {
  const safeSourceKey = candidate.provenance.source_key
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 96);

  return `mem_${safeSourceKey || "record"}`;
}

function isNotFoundError(error: unknown): boolean {
  return typeof error === "object"
    && error !== null
    && "code" in error
    && (error as { code?: string }).code === "ENOENT";
}
