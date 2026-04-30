import { TaskGraphSchedulerError } from "../errors.js";
import type { AgentActionType } from "../agent_action/index.js";

export const nodeTypes = ["individual", "team"] as const;
export type NodeType = (typeof nodeTypes)[number];

export const nodeStatuses = ["active", "inactive"] as const;
export type NodeStatus = (typeof nodeStatuses)[number];

export const teamRoutingModes = ["team_decides"] as const;
export type TeamRoutingMode = (typeof teamRoutingModes)[number];

export interface RuntimeRef {
  runtime?: string;
  runtime_ref?: Record<string, unknown>;
}

export interface RegisteredNode extends RuntimeRef {
  node_id: string;
  node_type: NodeType;
  display_name: string;
  declared_capabilities: string[];
  requested_actions: AgentActionType[];
  granted_actions: AgentActionType[];
  status: NodeStatus;
  registered_at: string;
  updated_at: string;
}

export interface TeamMember {
  node_id: string;
  team_role: string;
  declared_capabilities: string[];
}

export interface TeamComposition {
  team_node_id: string;
  lead_node_id: string;
  routing_mode: TeamRoutingMode;
  members: TeamMember[];
  updated_at: string;
}

export interface TeamContext {
  team_node_id: string;
  role?: string;
}

export interface NodeRegistrationNodeInput extends RuntimeRef {
  node_id: string;
  node_type: NodeType;
  display_name?: string;
  declared_capabilities?: string[];
  requested_actions?: AgentActionType[];
  granted_actions?: AgentActionType[];
  status?: NodeStatus;
}

export interface TeamCompositionInput {
  team_node_id: string;
  lead_node_id: string;
  routing_mode?: TeamRoutingMode;
  members: Array<{
    node_id: string;
    team_role: string;
    declared_capabilities?: string[];
  }>;
}

export interface NodeRegistrationProposal {
  schema_version: "node-registration.v1";
  nodes: NodeRegistrationNodeInput[];
  team_compositions?: TeamCompositionInput[];
}

export interface NodeRegistrySnapshot {
  version: 1;
  nodes: RegisteredNode[];
  team_compositions: TeamComposition[];
  updated_at: string | null;
}

export function normalizeNodeRegistrationProposal(
  proposal: NodeRegistrationProposal,
  now = new Date().toISOString(),
  existing: NodeRegistrySnapshot = emptyNodeRegistrySnapshot()
): NodeRegistrySnapshot {
  validateProposalShape(proposal);

  const existingNodes = new Map(existing.nodes.map((node) => [node.node_id, node]));
  const nodes = new Map<string, RegisteredNode>();
  for (const input of proposal.nodes) {
    validateNodeInput(input);
    const previous = existingNodes.get(input.node_id);
    nodes.set(input.node_id, {
      node_id: input.node_id,
      node_type: input.node_type,
      display_name: input.display_name ?? input.node_id,
      runtime: input.runtime,
      runtime_ref: input.runtime_ref,
      declared_capabilities: uniqueStrings(input.declared_capabilities ?? []),
      requested_actions: input.requested_actions ?? [],
      granted_actions: input.granted_actions ?? input.requested_actions ?? [],
      status: input.status ?? "active",
      registered_at: previous?.registered_at ?? now,
      updated_at: now
    });
  }

  for (const node of existing.nodes) {
    if (!nodes.has(node.node_id)) {
      nodes.set(node.node_id, node);
    }
  }

  const proposalNodes = new Map(proposal.nodes.map((node) => [node.node_id, node]));
  const allNodes = new Map(nodes);
  const teamCompositions = new Map(existing.team_compositions.map((team) => [team.team_node_id, team]));
  for (const teamInput of proposal.team_compositions ?? []) {
    validateTeamCompositionInput(teamInput, allNodes, proposalNodes);
    teamCompositions.set(teamInput.team_node_id, {
      team_node_id: teamInput.team_node_id,
      lead_node_id: teamInput.lead_node_id,
      routing_mode: teamInput.routing_mode ?? "team_decides",
      members: teamInput.members.map((member) => ({
        node_id: member.node_id,
        team_role: member.team_role,
        declared_capabilities: uniqueStrings(member.declared_capabilities ?? [])
      })),
      updated_at: now
    });
  }

  return {
    version: 1,
    nodes: sortNodes([...nodes.values()]),
    team_compositions: sortTeams([...teamCompositions.values()]),
    updated_at: now
  };
}

export function emptyNodeRegistrySnapshot(): NodeRegistrySnapshot {
  return {
    version: 1,
    nodes: [],
    team_compositions: [],
    updated_at: null
  };
}

export function sortNodes(nodes: RegisteredNode[]): RegisteredNode[] {
  return [...nodes].sort((a, b) => a.node_id.localeCompare(b.node_id));
}

export function sortTeams(teams: TeamComposition[]): TeamComposition[] {
  return [...teams].sort((a, b) => a.team_node_id.localeCompare(b.team_node_id));
}

function validateProposalShape(proposal: NodeRegistrationProposal): void {
  if (!proposal || typeof proposal !== "object") {
    throw new TaskGraphSchedulerError("Node registration proposal must be an object.", "NODE_REGISTRATION_INVALID");
  }
  if (proposal.schema_version !== "node-registration.v1") {
    throw new TaskGraphSchedulerError("Node registration schema_version is unsupported.", "NODE_REGISTRATION_SCHEMA_INVALID", {
      schema_version: proposal.schema_version
    });
  }
  if (!Array.isArray(proposal.nodes) || proposal.nodes.length === 0) {
    throw new TaskGraphSchedulerError("Node registration proposal requires nodes.", "NODE_REGISTRATION_NODES_REQUIRED");
  }
}

function validateNodeInput(input: NodeRegistrationNodeInput): void {
  assertNonEmpty(input.node_id, "node_id");
  if (!nodeTypes.includes(input.node_type)) {
    throw new TaskGraphSchedulerError("Node type is invalid.", "NODE_TYPE_INVALID", {
      node_id: input.node_id,
      node_type: input.node_type
    });
  }
  if (input.status && !nodeStatuses.includes(input.status)) {
    throw new TaskGraphSchedulerError("Node status is invalid.", "NODE_STATUS_INVALID", {
      node_id: input.node_id,
      status: input.status
    });
  }
}

function validateTeamCompositionInput(
  input: TeamCompositionInput,
  allNodes: Map<string, RegisteredNode>,
  proposalNodes: Map<string, NodeRegistrationNodeInput>
): void {
  assertNonEmpty(input.team_node_id, "team_node_id");
  assertNonEmpty(input.lead_node_id, "lead_node_id");
  if (!Array.isArray(input.members) || input.members.length === 0) {
    throw new TaskGraphSchedulerError("Team composition requires at least one member.", "TEAM_MEMBERS_REQUIRED", {
      team_node_id: input.team_node_id
    });
  }
  if (input.routing_mode && !teamRoutingModes.includes(input.routing_mode)) {
    throw new TaskGraphSchedulerError("Team routing mode is invalid.", "TEAM_ROUTING_MODE_INVALID", {
      team_node_id: input.team_node_id,
      routing_mode: input.routing_mode
    });
  }

  const teamNode = allNodes.get(input.team_node_id);
  if (!teamNode) {
    throw new TaskGraphSchedulerError("Team node must be registered.", "TEAM_NODE_NOT_REGISTERED", {
      team_node_id: input.team_node_id
    });
  }
  if (teamNode.node_type !== "team") {
    throw new TaskGraphSchedulerError("Team composition must reference a team node.", "TEAM_NODE_TYPE_INVALID", {
      team_node_id: input.team_node_id,
      node_type: teamNode.node_type
    });
  }

  const memberIds = new Set(input.members.map((member) => member.node_id));
  if (!memberIds.has(input.lead_node_id)) {
    throw new TaskGraphSchedulerError("Team lead must be a team member.", "TEAM_LEAD_NOT_MEMBER", {
      team_node_id: input.team_node_id,
      lead_node_id: input.lead_node_id
    });
  }

  for (const member of input.members) {
    assertNonEmpty(member.node_id, "member.node_id");
    assertNonEmpty(member.team_role, "member.team_role");
    const memberNode = allNodes.get(member.node_id) ?? proposalNodes.get(member.node_id);
    if (!memberNode) {
      throw new TaskGraphSchedulerError("Team member must be registered.", "TEAM_MEMBER_NOT_REGISTERED", {
        team_node_id: input.team_node_id,
        member_node_id: member.node_id
      });
    }
  }
}

function assertNonEmpty(value: unknown, field: string): void {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TaskGraphSchedulerError(`Node registry field ${field} is required.`, "NODE_REGISTRY_FIELD_REQUIRED", {
      field
    });
  }
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter((value) => typeof value === "string" && value.trim().length > 0).map((value) => value.trim()))].sort();
}
