import test from "node:test";
import assert from "node:assert/strict";
import { createDefaultTeamSnapshot, findControllerAgent, listTeamPeers } from "../src/team/index.js";

test("createDefaultTeamSnapshot keeps team lead inside agents", () => {
  const team = createDefaultTeamSnapshot("2026-04-30T00:00:00.000Z");
  const controller = findControllerAgent(team);

  assert.equal(team.team_id, "default-dev-team");
  assert.equal(team.source, "local_default");
  assert.equal(team.created_at, "2026-04-30T00:00:00.000Z");
  assert.equal(controller?.agent_id, "team-lead-agent");
  assert.equal(controller?.permissions.assign_task, true);
  assert.equal(controller?.permissions.create_task, true);
  assert.equal(controller?.permissions.review_wave, true);
  assert.deepEqual(controller?.capabilities, ["planning", "task_decomposition", "coordination"]);
});

test("listTeamPeers exposes same-team peers without collaboration allowlists", () => {
  const team = createDefaultTeamSnapshot("2026-04-30T00:00:00.000Z");
  const peers = listTeamPeers(team, "team-lead-agent");

  assert.deepEqual(peers.map((agent) => agent.agent_id), ["review-agent"]);
  assert.equal("collaboration" in team.agents[0]!, false);
});
