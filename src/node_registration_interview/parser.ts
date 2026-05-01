import { TaskGraphSchedulerError } from "../errors.js";
import {
  normalizeNodeRegistrationProposal,
  type NodeRegistrationProposal
} from "../node_registry/index.js";

export interface ParsedNodeRegistrationProposalReply {
  proposal: NodeRegistrationProposal;
}

export function parseNodeRegistrationProposalReply(reply: unknown): ParsedNodeRegistrationProposalReply {
  const candidate = extractProposalCandidate(reply);

  try {
    normalizeNodeRegistrationProposal(candidate as NodeRegistrationProposal);
  } catch (error) {
    if (error instanceof TaskGraphSchedulerError) {
      throw error;
    }

    throw new TaskGraphSchedulerError("Node registration proposal reply is invalid.", "NODE_REGISTRATION_REPLY_INVALID", {
      cause: error instanceof Error ? error.message : String(error)
    });
  }

  return {
    proposal: candidate as NodeRegistrationProposal
  };
}

function extractProposalCandidate(reply: unknown): unknown {
  if (isRecord(reply) && "schema_version" in reply) {
    return reply;
  }

  if (isRecord(reply)) {
    const text = firstString(reply, ["proposal", "content", "reply", "message", "text"]);
    if (text) {
      return parseProposalJsonText(text);
    }
  }

  if (typeof reply === "string") {
    return parseProposalJsonText(reply);
  }

  throw new TaskGraphSchedulerError("Node registration reply must contain a proposal.", "NODE_REGISTRATION_REPLY_MISSING");
}

function parseProposalJsonText(text: string): unknown {
  const jsonText = extractJsonObjectText(text);
  try {
    return JSON.parse(jsonText) as unknown;
  } catch (error) {
    throw new TaskGraphSchedulerError("Node registration reply JSON is invalid.", "NODE_REGISTRATION_REPLY_JSON_INVALID", {
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
