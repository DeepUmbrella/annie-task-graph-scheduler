import { TaskGraphSchedulerError } from "../errors.js";
import type { AgentActionType } from "../agent_action/index.js";
import type { NodeType } from "../node_registry/index.js";

export const runtimeCandidateStatuses = ["available", "unavailable"] as const;
export type RuntimeCandidateStatus = (typeof runtimeCandidateStatuses)[number];

export interface RuntimeCandidate {
  runtime: string;
  status: RuntimeCandidateStatus;
  discovered_at: string;
  command?: string;
  version?: string;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface CandidateNode {
  candidate_id: string;
  runtime: string;
  runtime_ref?: Record<string, unknown>;
  node_id_hint: string;
  node_type_hint: NodeType;
  display_name?: string;
  declared_capabilities: string[];
  requested_actions: AgentActionType[];
  discovered_at: string;
  raw?: unknown;
}

export interface RuntimeDiscoverySnapshot {
  version: 1;
  runtimes: RuntimeCandidate[];
  candidates: CandidateNode[];
  updated_at: string | null;
}

export interface RuntimeDiscoveryInput {
  runtimes?: RuntimeCandidate[];
  candidates?: CandidateNode[];
}

export function normalizeRuntimeDiscoverySnapshot(
  input: RuntimeDiscoveryInput,
  now = new Date().toISOString()
): RuntimeDiscoverySnapshot {
  const runtimes = (input.runtimes ?? []).map((runtime) => normalizeRuntimeCandidate(runtime, now));
  const candidates = (input.candidates ?? []).map((candidate) => normalizeCandidateNode(candidate, now));

  return {
    version: 1,
    runtimes: sortRuntimeCandidates(dedupeRuntimes(runtimes)),
    candidates: sortCandidateNodes(dedupeCandidates(candidates)),
    updated_at: now
  };
}

export function emptyRuntimeDiscoverySnapshot(): RuntimeDiscoverySnapshot {
  return {
    version: 1,
    runtimes: [],
    candidates: [],
    updated_at: null
  };
}

export function normalizeRuntimeCandidate(input: RuntimeCandidate, now = new Date().toISOString()): RuntimeCandidate {
  assertNonEmpty(input.runtime, "runtime");
  if (!runtimeCandidateStatuses.includes(input.status)) {
    throw new TaskGraphSchedulerError("Runtime candidate status is invalid.", "RUNTIME_CANDIDATE_STATUS_INVALID", {
      runtime: input.runtime,
      status: input.status
    });
  }

  return {
    runtime: input.runtime.trim(),
    status: input.status,
    discovered_at: input.discovered_at ?? now,
    command: trimOptional(input.command),
    version: trimOptional(input.version),
    error: trimOptional(input.error),
    metadata: input.metadata
  };
}

export function normalizeCandidateNode(input: CandidateNode, now = new Date().toISOString()): CandidateNode {
  assertNonEmpty(input.candidate_id, "candidate_id");
  assertNonEmpty(input.runtime, "runtime");
  assertNonEmpty(input.node_id_hint, "node_id_hint");
  if (input.node_type_hint !== "individual" && input.node_type_hint !== "team") {
    throw new TaskGraphSchedulerError("Candidate node type hint is invalid.", "CANDIDATE_NODE_TYPE_HINT_INVALID", {
      candidate_id: input.candidate_id,
      node_type_hint: input.node_type_hint
    });
  }

  return {
    candidate_id: input.candidate_id.trim(),
    runtime: input.runtime.trim(),
    runtime_ref: input.runtime_ref,
    node_id_hint: input.node_id_hint.trim(),
    node_type_hint: input.node_type_hint,
    display_name: trimOptional(input.display_name),
    declared_capabilities: uniqueStrings(input.declared_capabilities ?? []),
    requested_actions: [...new Set(input.requested_actions ?? [])].sort(),
    discovered_at: input.discovered_at ?? now,
    raw: input.raw
  };
}

export function sortRuntimeCandidates(runtimes: RuntimeCandidate[]): RuntimeCandidate[] {
  return [...runtimes].sort((a, b) => a.runtime.localeCompare(b.runtime));
}

export function sortCandidateNodes(candidates: CandidateNode[]): CandidateNode[] {
  return [...candidates].sort((a, b) => a.candidate_id.localeCompare(b.candidate_id));
}

function dedupeRuntimes(runtimes: RuntimeCandidate[]): RuntimeCandidate[] {
  return [...new Map(runtimes.map((runtime) => [runtime.runtime, runtime])).values()];
}

function dedupeCandidates(candidates: CandidateNode[]): CandidateNode[] {
  return [...new Map(candidates.map((candidate) => [candidate.candidate_id, candidate])).values()];
}

function assertNonEmpty(value: unknown, field: string): void {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TaskGraphSchedulerError(`Runtime discovery field ${field} is required.`, "RUNTIME_DISCOVERY_FIELD_REQUIRED", {
      field
    });
  }
}

function trimOptional(value: string | undefined): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter((value) => typeof value === "string" && value.trim().length > 0).map((value) => value.trim()))].sort();
}
