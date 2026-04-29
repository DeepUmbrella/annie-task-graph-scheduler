import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { TaskGraphSchedulerError } from "../errors.js";

export interface WorkflowIntent {
  intent_id: string;
  goal: string;
  source: "openclaw";
  status: "received";
  created_at: string;
  raw_message_ref: {
    inbound_log_path: string;
    received_at: string;
  };
  payload: unknown;
}

export interface CreatedWorkflowIntent {
  intent: WorkflowIntent;
  path: string;
}

export interface CreateWorkflowIntentOptions {
  rootDir?: string;
  inboundLogPath: string;
  receivedAt: string;
  now?: string;
}

export function intentsDir(rootDir = ".annie"): string {
  return join(rootDir, "intents");
}

export function intentPath(rootDir: string, intentId: string): string {
  return join(intentsDir(rootDir), `${intentId}.json`);
}

export async function createWorkflowIntentFromInboundPayload(
  payload: unknown,
  options: CreateWorkflowIntentOptions
): Promise<CreatedWorkflowIntent> {
  const rootDir = options.rootDir ?? ".annie";
  const createdAt = options.now ?? new Date().toISOString();
  const goal = extractGoal(payload);
  const intentId = createIntentId(goal, createdAt);
  const path = intentPath(rootDir, intentId);
  const intent: WorkflowIntent = {
    intent_id: intentId,
    goal,
    source: "openclaw",
    status: "received",
    created_at: createdAt,
    raw_message_ref: {
      inbound_log_path: options.inboundLogPath,
      received_at: options.receivedAt
    },
    payload
  };

  await mkdir(intentsDir(rootDir), { recursive: true });
  await writeFile(path, `${JSON.stringify(intent, null, 2)}\n`, "utf8");

  return {
    intent,
    path
  };
}

function extractGoal(payload: unknown): string {
  if (typeof payload === "string" && payload.trim().length > 0) {
    return payload.trim();
  }

  if (typeof payload !== "object" || payload === null) {
    throw new TaskGraphSchedulerError("Inbound message does not contain a workflow goal.", "INTENT_GOAL_MISSING", {
      expected_fields: ["goal", "message", "text"]
    });
  }

  const record = payload as Record<string, unknown>;
  for (const field of ["goal", "message", "text"]) {
    const value = record[field];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  throw new TaskGraphSchedulerError("Inbound message does not contain a workflow goal.", "INTENT_GOAL_MISSING", {
    expected_fields: ["goal", "message", "text"]
  });
}

function createIntentId(goal: string, createdAt: string): string {
  const safeGoal = goal
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  const timestamp = createdAt.replace(/[^0-9]/g, "").slice(0, 14);
  const suffix = Math.random().toString(36).slice(2, 8);

  return `intent_${timestamp}_${safeGoal || "workflow"}_${suffix}`;
}
