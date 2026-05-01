import { TaskGraphSchedulerError } from "../errors.js";
import type { TaskDagPlan } from "../models/plan.js";
import { loadPlan } from "../validation/plan_loader.js";
import type { PlanProposalIntakePayload } from "./model.js";

export function parsePlanProposalPayload(payload: unknown): PlanProposalIntakePayload {
  if (!isRecord(payload)) {
    throw new TaskGraphSchedulerError("Plan proposal payload must be an object.", "PLAN_PROPOSAL_PAYLOAD_INVALID");
  }

  const intentId = firstString(payload, ["intent_id", "workflow_id"]);
  const from = firstString(payload, ["from", "agent_id", "planner_agent_id"]);
  const runtime = firstString(payload, ["runtime", "runtime_id"]);
  const plan = extractPlan(payload);

  if (!intentId) {
    throw new TaskGraphSchedulerError("Plan proposal payload requires intent_id.", "PLAN_PROPOSAL_INTENT_REQUIRED");
  }
  if (!from) {
    throw new TaskGraphSchedulerError("Plan proposal payload requires from.", "PLAN_PROPOSAL_FROM_REQUIRED");
  }

  loadPlan(plan);

  return {
    intent_id: intentId,
    from,
    runtime,
    plan,
    raw_payload: payload
  };
}

function extractPlan(payload: Record<string, unknown>): TaskDagPlan {
  const direct = payload.plan ?? payload.task_dag_plan ?? payload.dag_plan;
  if (isRecord(direct)) {
    return direct as unknown as TaskDagPlan;
  }

  const text = firstString(payload, ["plan_json", "content", "reply", "message", "text"]);
  if (text) {
    return parsePlanJsonText(text);
  }

  if (payload.plan_id && payload.plan_type && payload.tasks) {
    return payload as unknown as TaskDagPlan;
  }

  throw new TaskGraphSchedulerError("Plan proposal payload requires a TaskDagPlan.", "PLAN_PROPOSAL_PLAN_REQUIRED");
}

function parsePlanJsonText(text: string): TaskDagPlan {
  const jsonText = extractJsonObjectText(text);
  try {
    return JSON.parse(jsonText) as TaskDagPlan;
  } catch (error) {
    throw new TaskGraphSchedulerError("Plan proposal JSON is invalid.", "PLAN_PROPOSAL_JSON_INVALID", {
      cause: error instanceof Error ? error.message : String(error)
    });
  }
}

function extractJsonObjectText(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }

  const trimmed = text.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return trimmed.slice(start, end + 1);
  }

  return trimmed;
}

function firstString(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
