export const waveStatuses = [
  "pending",
  "running",
  "reviewing",
  "done",
  "failed",
  "blocked"
] as const;

export type WaveStatus = (typeof waveStatuses)[number];

export interface SkippedReadyTask {
  task_id: string;
  reason: string;
}

export interface WaveReview {
  status: "passed" | "failed";
  completed_tasks: string[];
  failed_tasks: string[];
  conflicts: string[];
  allow_next_wave: boolean;
  summary?: string;
}

export interface Wave {
  id: string;
  tasks: string[];
  status: WaveStatus;
  started_at: string | null;
  completed_at: string | null;
  review: WaveReview | null;
  reason: string;
  skipped_ready_tasks: SkippedReadyTask[];
}
