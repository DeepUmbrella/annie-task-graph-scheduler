import type { OpenClawCommandRunner } from "../communication/openclaw_adapter.js";
import type { CandidateNode, RuntimeDiscoverySnapshot } from "./model.js";
import { normalizeRuntimeDiscoverySnapshot } from "./model.js";

export interface OpenClawDiscoveryOptions {
  command?: string;
  runner?: OpenClawCommandRunner;
  now?: string;
}

export interface OpenClawAgentListItem extends Record<string, unknown> {
  id?: string;
  agent_id?: string;
  name?: string;
  display_name?: string;
  type?: string;
  node_type?: string;
  capabilities?: unknown;
  declared_capabilities?: unknown;
}

export async function discoverOpenClawCandidates(options: OpenClawDiscoveryOptions = {}): Promise<RuntimeDiscoverySnapshot> {
  const command = options.command ?? "openclaw";
  const now = options.now ?? new Date().toISOString();
  const runner = options.runner ?? unavailableRunner;

  try {
    const result = await runner(command, ["agents", "list", "--json"]);
    const agents = parseOpenClawAgentsList(result.stdout);

    return normalizeRuntimeDiscoverySnapshot({
      runtimes: [
        {
          runtime: "openclaw",
          status: "available",
          discovered_at: now,
          command: `${command} agents list --json`,
          metadata: {
            stderr: result.stderr || undefined
          }
        }
      ],
      candidates: agents.map((agent) => toOpenClawCandidateNode(agent, now))
    }, now);
  } catch (error) {
    return normalizeRuntimeDiscoverySnapshot({
      runtimes: [
        {
          runtime: "openclaw",
          status: "unavailable",
          discovered_at: now,
          command: `${command} agents list --json`,
          error: error instanceof Error ? error.message : String(error)
        }
      ],
      candidates: []
    }, now);
  }
}

export function parseOpenClawAgentsList(stdout: string): OpenClawAgentListItem[] {
  const parsed = JSON.parse(stdout) as unknown;
  if (Array.isArray(parsed)) {
    return parsed.filter(isRecord).map((item) => item as OpenClawAgentListItem);
  }
  if (isRecord(parsed) && Array.isArray(parsed.agents)) {
    return parsed.agents.filter(isRecord).map((item) => item as OpenClawAgentListItem);
  }

  return [];
}

function toOpenClawCandidateNode(agent: OpenClawAgentListItem, discoveredAt: string): CandidateNode {
  const agentId = firstString(agent, ["agent_id", "id", "name"]) ?? "unknown-agent";
  const nodeType: CandidateNode["node_type_hint"] = firstString(agent, ["node_type", "type"]) === "team" ? "team" : "individual";

  return {
    candidate_id: `openclaw:${agentId}`,
    runtime: "openclaw",
    runtime_ref: {
      agent_id: agentId
    },
    node_id_hint: agentId,
    node_type_hint: nodeType,
    display_name: firstString(agent, ["display_name", "name", "agent_id", "id"]) ?? agentId,
    declared_capabilities: toStringList(agent.declared_capabilities ?? agent.capabilities),
    requested_actions: ["send_message"],
    discovered_at: discoveredAt,
    raw: agent
  };
}

async function unavailableRunner(command: string): Promise<never> {
  throw new Error(`No runner configured for ${command}.`);
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

function toStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
