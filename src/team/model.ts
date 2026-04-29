export type TeamAgentRole = "controller" | "planner" | "executor" | "reviewer";

export interface TeamPermissions {
  receive_task: boolean;
  assign_task: boolean;
  create_task: boolean;
  review_wave: boolean;
  request_help: boolean;
}

export interface TeamAgent {
  agent_id: string;
  role: TeamAgentRole;
  capabilities: string[];
  permissions: TeamPermissions;
}

export interface TeamSnapshot {
  team_id: string;
  source: "local_default" | "openclaw_config";
  agents: TeamAgent[];
  created_at: string;
}

export function createDefaultTeamSnapshot(now = new Date().toISOString()): TeamSnapshot {
  return {
    team_id: "default-dev-team",
    source: "local_default",
    created_at: now,
    agents: [
      {
        agent_id: "team-lead-agent",
        role: "controller",
        capabilities: ["planning", "task_decomposition", "coordination"],
        permissions: {
          receive_task: true,
          assign_task: true,
          create_task: true,
          review_wave: true,
          request_help: true
        }
      },
      {
        agent_id: "review-agent",
        role: "reviewer",
        capabilities: ["review", "test"],
        permissions: {
          receive_task: true,
          assign_task: false,
          create_task: false,
          review_wave: true,
          request_help: true
        }
      }
    ]
  };
}

export function createPlannerTeamSnapshot(
  plannerAgentId: string,
  now = new Date().toISOString()
): TeamSnapshot {
  return {
    team_id: `openclaw-${plannerAgentId}`,
    source: "openclaw_config",
    created_at: now,
    agents: [
      {
        agent_id: plannerAgentId,
        role: "controller",
        capabilities: ["planning", "task_decomposition", "coordination"],
        permissions: {
          receive_task: true,
          assign_task: true,
          create_task: true,
          review_wave: true,
          request_help: true
        }
      }
    ]
  };
}

export function findControllerAgent(team: TeamSnapshot): TeamAgent | null {
  return team.agents.find((agent) =>
    agent.role === "controller"
    && agent.permissions.receive_task
    && agent.permissions.create_task
  ) ?? null;
}

export function listTeamPeers(team: TeamSnapshot, agentId: string): TeamAgent[] {
  return team.agents.filter((agent) => agent.agent_id !== agentId);
}
