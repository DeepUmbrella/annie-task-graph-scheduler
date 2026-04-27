export const memoryCategories = ["execution_result", "preference", "template_pattern"] as const;

export type MemoryCategory = (typeof memoryCategories)[number];

export const memoryConfidenceLevels = ["low", "medium", "high"] as const;

export type MemoryConfidence = (typeof memoryConfidenceLevels)[number];

export interface MemoryProvenance {
  workflow_id: string;
  plan_id: string;
  wave_id: string | null;
  task_id: string | null;
  source: "workflow_state" | "scheduler_decision" | "template_usage" | "manual";
  source_key: string;
  created_at: string;
}

export interface MemoryCandidate {
  category: MemoryCategory;
  title: string;
  summary: string;
  content: Record<string, unknown>;
  confidence: MemoryConfidence;
  reason: string;
  tags: string[];
  provenance: MemoryProvenance;
}

export interface MemoryRecord extends MemoryCandidate {
  id: string;
  stored_at: string;
}

export interface MemoryAdapter {
  append(candidate: MemoryCandidate, options?: MemoryWriteOptions): Promise<MemoryRecord>;
  list(filter?: MemoryListFilter): Promise<MemoryRecord[]>;
  findByCategory(category: MemoryCategory): Promise<MemoryRecord[]>;
}

export interface MemoryWriteOptions {
  now?: string;
}

export interface MemoryListFilter {
  category?: MemoryCategory;
  tag?: string;
  workflow_id?: string;
}
