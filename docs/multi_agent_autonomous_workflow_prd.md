# Multi-Agent Autonomous Workflow PRD

## 1. Document Info

| Item | Value |
|---|---|
| Product Area | Annie Multi-Agent Autonomous Workflow |
| Related Project | Annie TaskGraphScheduler |
| Document Type | Supplemental PRD |
| Status | Draft |
| Date | 2026-04-28 |

## 2. Background

The original goal of TaskGraphScheduler is not only to schedule a static DAG.

The broader product goal is to let a user ask Annie for a high-level outcome, such as:

```txt
Create a website.
```

Annie should then coordinate an OpenClaw-based agent team that can:

- clarify or confirm requirements
- decompose the goal into tasks
- assign work to suitable execution agents
- allow agents in the team to communicate through mailbox messages
- review each wave of work
- continue until delivery or until human clarification is required

TaskGraphScheduler is the orchestration kernel for this flow. It should not replace OpenClaw agents. OpenClaw agents should still perform planning, decomposition, implementation, and review. TaskGraphScheduler defines the contract, state, scheduling, mailbox, review, and reporting layer that makes the process controllable and auditable.

## 3. Product Goal

Enable this flow:

```txt
User
  -> Annie
  -> OpenClaw team controller agent
  -> planner/team agent decomposes goal into DAG
  -> TaskGraphScheduler validates and schedules DAG
  -> OpenClaw execution agents perform tasks
  -> team agents communicate through MessageBus/Mailbox
  -> ReviewGate approves each wave
  -> next wave continues automatically
  -> final report and memory records are produced
```

The system should support autonomous multi-agent collaboration while preserving:

- explicit task state
- DAG dependencies
- controlled task assignment
- mailbox-based communication
- review gates
- audit logs
- recovery
- human interruption when requirements or permissions are unclear

## 4. Core Scenario

### Example User Request

```txt
User: Create a website.
```

### Expected Flow

1. Annie receives the user request.
2. Annie selects or creates a team from OpenClaw agent config.
3. A team controller/planner agent decomposes the request into a DAG plan.
4. TaskGraphScheduler validates the DAG plan.
5. TaskGraphScheduler initializes workflow state.
6. Scheduler creates the first executable wave.
7. Orchestrator dispatches tasks to team agents through MessageBus/OpenClaw adapter.
8. Execution agents do the work.
9. Agents can communicate with other agents in the same team through mailbox messages.
10. Agents submit structured results.
11. ReviewGate evaluates the wave.
12. If review passes, Scheduler continues to the next wave.
13. If review fails or requirements are unclear, the workflow pauses for correction or human input.
14. When complete, TaskGraphScheduler produces execution report and memory candidates.

## 5. Key Design Decisions

### 5.1 OpenClaw Agents Do The Planning And Work

OpenClaw agents are responsible for:

- team-level planning
- task decomposition
- implementation
- review
- collaboration

TaskGraphScheduler is responsible for:

- defining and validating the DAG/task/result formats
- turning DAG tasks into safe execution waves
- assigning tasks according to team agent capabilities and policy
- routing messages through MessageBus/Mailbox
- collecting structured results
- enforcing ReviewGate
- persisting state and audit logs
- producing reports and memory records

### 5.2 OpenClaw Config Is The Agent Source Of Truth

The preferred source for available agents is OpenClaw config.

TaskGraphScheduler should not maintain a competing hard-coded global agent registry.

Recommended direction:

```txt
OpenClaw config
  -> read agent definitions
  -> build team-scoped snapshot
  -> use snapshot for scheduling and validation
```

The Annie-side snapshot exists for auditability and repeatability. It should represent the agent team used for a workflow at a point in time.

### 5.3 Team Lead Is Also A Team Agent

The team lead/controller is not a special field outside the team.

All team members are represented in `agents[]`.

Example:

```json
{
  "team_id": "website-dev-team",
  "agents": [
    {
      "agent_id": "team-lead-agent",
      "role": "controller",
      "capabilities": ["planning", "task_decomposition", "coordination"],
      "permissions": {
        "receive_task": true,
        "assign_task": true,
        "create_task": true,
        "review_wave": true,
        "request_help": true
      }
    },
    {
      "agent_id": "frontend-agent",
      "role": "executor",
      "capabilities": ["frontend", "react", "browser"],
      "permissions": {
        "receive_task": true,
        "assign_task": false,
        "create_task": false,
        "review_wave": false,
        "request_help": true
      }
    }
  ]
}
```

Controllers, reviewers, planners, and executors are all agents. Their differences are expressed through role, capabilities, and permissions.

### 5.4 No Per-Agent Collaboration Whitelist

Do not add fields such as:

```json
{
  "collaboration": {
    "can_request_help_from": ["frontend-agent"],
    "can_receive_help_requests_from": ["backend-agent"]
  }
}
```

The team itself defines the communication boundary.

Team agents should be able to communicate with other agents in the same team through MessageBus/Mailbox. Permissions and protocol validation decide which message types are allowed.

Recommended rule:

```txt
available peers = agents in the same team except self
```

Then:

```txt
ProtocolValidator validates sender, receiver, message_type, and permissions.
```

Examples:

```txt
frontend-agent -> backend-agent HELP_REQUESTED: allowed
frontend-agent -> review-agent QUESTION_ASKED: allowed
backend-agent -> frontend-agent ANSWER_PROVIDED: allowed
frontend-agent -> backend-agent TASK_ASSIGNED: denied unless sender has assign_task
frontend-agent -> StateStore direct update: denied
```

## 6. Proposed Runtime Model

### 6.1 Workflow Intent

Annie converts the user request into a workflow intent.

Example:

```json
{
  "intent_id": "intent_create_website",
  "goal": "Create a website",
  "constraints": {},
  "preferred_team": "website-dev-team",
  "created_by": "user"
}
```

### 6.2 Team Snapshot

The team snapshot is derived from OpenClaw config and captured into workflow state or adjacent metadata.

Example:

```json
{
  "team_id": "website-dev-team",
  "source": "openclaw_config",
  "agents": [
    {
      "agent_id": "team-lead-agent",
      "role": "controller",
      "capabilities": ["planning", "task_decomposition", "coordination"],
      "permissions": {
        "receive_task": true,
        "assign_task": true,
        "create_task": true,
        "review_wave": true,
        "request_help": true
      }
    },
    {
      "agent_id": "frontend-agent",
      "role": "executor",
      "capabilities": ["frontend", "react", "browser"],
      "permissions": {
        "receive_task": true,
        "assign_task": false,
        "create_task": false,
        "review_wave": false,
        "request_help": true
      }
    },
    {
      "agent_id": "review-agent",
      "role": "reviewer",
      "capabilities": ["review", "test"],
      "permissions": {
        "receive_task": true,
        "assign_task": false,
        "create_task": false,
        "review_wave": true,
        "request_help": true
      }
    }
  ]
}
```

### 6.3 Planner Output Contract

The team controller/planner agent outputs a DAG plan that TaskGraphScheduler already knows how to validate.

Example:

```json
{
  "plan_id": "plan_create_website",
  "plan_type": "dag",
  "execution_policy": {
    "max_parallel_tasks": 3,
    "review_after_each_wave": true
  },
  "tasks": [
    {
      "id": "T1",
      "title": "Confirm website requirements",
      "depends_on": [],
      "required_capabilities": ["planning"],
      "preferred_agent": "team-lead-agent"
    },
    {
      "id": "T2",
      "title": "Implement website frontend",
      "depends_on": ["T1"],
      "required_capabilities": ["frontend"],
      "preferred_agent": "frontend-agent"
    },
    {
      "id": "T3",
      "title": "Review website implementation",
      "depends_on": ["T2"],
      "required_capabilities": ["review"],
      "preferred_agent": "review-agent"
    }
  ]
}
```

### 6.4 Agent Result Contract

Execution agents submit structured task results.

Example:

```json
{
  "task_id": "T2",
  "status": "completed",
  "summary": "Implemented the website homepage.",
  "changed_files": ["src/App.tsx"],
  "tests_run": ["npm test"],
  "risks": [],
  "next_recommendation": "Run review."
}
```

Agent results do not directly mutate workflow state. They are processed by ResultCollector and StateStore.

## 7. Message And Permission Rules

### 7.1 Communication Boundary

Agents in the same team can communicate through MessageBus/Mailbox.

MessageBus must persist:

- sender outbox
- receiver inbox
- delivery state
- ACK/processed state when applicable

### 7.2 State Boundary

Agent messages do not directly change task state.

Only orchestrator-controlled flow can update StateStore:

```txt
Agent message
  -> MessageBus
  -> ProtocolValidator
  -> Orchestrator / ResultCollector / ReviewGate
  -> StateStore
```

### 7.3 Permission Examples

Allowed:

```txt
executor -> executor HELP_REQUESTED
executor -> reviewer QUESTION_ASKED
reviewer -> executor REVIEW_COMMENT
controller -> executor TASK_ASSIGNED
```

Denied:

```txt
executor -> executor TASK_ASSIGNED
executor -> StateStore update
executor -> create task without create_task permission
executor -> approve wave without review_wave permission
```

## 8. End-To-End Flow

```txt
1. User asks Annie to create a website.
2. Annie creates workflow intent.
3. Annie reads OpenClaw config and builds a team snapshot.
4. Annie sends planning request to team controller agent.
5. Controller/planner agent returns DAG plan.
6. TaskGraphScheduler validates DAG.
7. Workflow state is initialized.
8. Scheduler creates next wave.
9. Orchestrator dispatches tasks to OpenClaw agents.
10. Agents execute tasks.
11. Agents communicate through MessageBus/Mailbox when needed.
12. Agents submit structured results.
13. ResultCollector moves tasks into reviewing or failed.
14. ReviewGate checks the wave.
15. If passed, Scheduler continues to next wave.
16. If failed or ambiguous, workflow pauses for correction or user input.
17. When complete, execution report and memory candidates are produced.
```

## 9. Current Implementation Status

Already implemented in this repository:

- DAG plan validation
- workflow state persistence
- wave scheduling
- worker assignment model
- MessageBus and MailboxStore
- protocol validation boundary
- result collection
- ReviewGate
- execution CLI
- workflow report
- memory candidate extraction and local store
- handoff docs and examples
- runtime-neutral agent message intake through `POST /agent-messages`
- runtime-agnostic `RegisteredNode` and `TeamComposition` models
- local Node Registry persistence at `.annie/nodes/registry.json`
- runtime-neutral `POST /nodes/register` and `GET /nodes`
- runtime-neutral `GET /nodes/candidates`
- single-member team registration support
- team context membership validation boundary
- action policy derivation from registered nodes
- runtime discovery candidate model and local discovery snapshot persistence
- OpenClaw discovery adapter for `openclaw agents list --json`
- node registration interview template
- runtime reply parser for `NodeRegistrationProposal`
- registration approval boundary for `granted_actions`
- team delegation action `delegate_to_member`
- team-scoped delegation validation
- agent message `team_context` intake
- registry-derived delegation policy for `TASK_ASSIGNED`
- plan proposal intake for validated `TaskDagPlan`
- local plan proposal persistence at `.annie/plans/proposals.json`
- runtime-neutral `POST /plan-proposals` and `GET /plan-proposals`
- workflow bootstrap from saved plan proposal
- runtime-neutral `POST /workflow-bootstrap`
- bootstrap audit event `WORKFLOW_BOOTSTRAPPED`

Not yet implemented:

- scheduling the next executable wave from a bootstrapped workflow through the autonomous workflow path
- dispatching scheduled wave tasks to registered nodes through mailbox and runtime adapters
- receiving structured task results through a runtime-neutral intake endpoint
- review-agent / ReviewGate based wave approval flow in the autonomous path
- automatic wave-to-wave advancement loop
- workflow pause / resume states for clarification, approval, failure, or missing permissions
- real OpenClaw session spawn / send / callback or polling integration for execution agents
- node heartbeat, runtime online state, and capability refresh
- dynamic re-planning or task creation from agents during an active workflow

## 10. Suggested Next Phase

Historical recommendation before the Node Registry revision:

```txt
Phase 10: Team Agent Directory And Collaboration Boundary
```

Potential tasks:

1. Define TeamSnapshot / TeamAgent / TeamPermissions models.
2. Add OpenClaw config reader boundary.
3. Build team-scoped agent directory from OpenClaw config.
4. Add capability coverage validation for DAG tasks.
5. Extend ProtocolValidator to use team membership and permissions.
6. Add tests for same-team communication and denied task assignment.

## 11. Open Questions

1. Exact OpenClaw config shape available in the target runtime.
2. Whether a team is selected by user, Annie, or OpenClaw config default.
3. Whether multiple controllers are allowed in one team.
4. How human approval is represented in messages and workflow state.
5. When an execution agent can ask the controller to create new tasks.

Until these are confirmed, implementation should favor local models, adapters, and validation boundaries rather than hard-coding remote OpenClaw behavior.

## 12. 2026-05 Node Registry And Team Composition Revision

### 12.1 Revision Context

After validating the early OpenClaw integration path, the product direction changed from:

```txt
OpenClaw agent config is the agent source of truth
```

to:

```txt
Annie has a runtime-agnostic node registry.
OpenClaw is one possible runtime / discovery / transport adapter.
```

This revision supersedes the earlier assumption that OpenClaw config directly becomes the team registry. OpenClaw discovery can produce node candidates, but nodes must register into Annie's own registry before they become collaboration participants.

### 12.2 Runtime-Agnostic Node Model

The core collaboration subject is a node.

A node may be backed by:

- OpenClaw agent
- local process
- remote service
- human-operated worker
- future runtime adapter

OpenClaw-specific fields are runtime metadata, not the primary identity model.

Recommended node shape:

```json
{
  "node_id": "develop-team",
  "node_type": "team",
  "display_name": "Develop Team",
  "runtime": "openclaw",
  "runtime_ref": {
    "agent_id": "develop-team"
  },
  "declared_capabilities": ["planning", "delivery"],
  "status": "active"
}
```

### 12.3 Discovery Is Not Registration

Runtime discovery only finds candidates.

Example:

```txt
RuntimeDetector
  -> detects OpenClaw installation
  -> OpenClawDiscovery reads openclaw agents list --json
  -> emits CandidateNode records
```

A candidate is not trusted as a registered node yet.

Registration requires:

1. A node registration proposal.
2. Schema validation.
3. Registry persistence.
4. Action policy derivation or user/system approval.

### 12.4 Capability Interview

When a runtime candidate is discovered, Annie may interview it with a registration template.

Example:

```txt
TaskGraphScheduler
  -> ask candidate node to describe itself using NodeRegistrationProposal v1
  -> candidate replies with JSON proposal
  -> TaskGraphScheduler validates and stores it
```

If a runtime node can call HTTP, it may submit directly:

```txt
POST /nodes/register
```

If it cannot call HTTP, the runtime adapter may capture the node's structured reply and submit the proposal on its behalf.

### 12.5 Node Registration Proposal

Recommended proposal:

```json
{
  "schema_version": "node-registration.v1",
  "nodes": [
    {
      "node_id": "develop-team",
      "node_type": "team",
      "display_name": "Develop Team",
      "runtime": "openclaw",
      "runtime_ref": {
        "agent_id": "develop-team"
      },
      "declared_capabilities": ["planning", "delivery"],
      "requested_actions": ["send_message", "propose_plan", "delegate_to_member"]
    },
    {
      "node_id": "annie-dev",
      "node_type": "individual",
      "display_name": "Annie Dev",
      "runtime": "openclaw",
      "runtime_ref": {
        "agent_id": "annie-dev"
      },
      "declared_capabilities": ["frontend", "backend", "implementation"],
      "requested_actions": ["send_message", "submit_result", "request_help"]
    }
  ],
  "team_compositions": [
    {
      "team_node_id": "develop-team",
      "lead_node_id": "annie-dev",
      "routing_mode": "team_decides",
      "members": [
        {
          "node_id": "annie-dev",
          "team_role": "lead_developer",
          "declared_capabilities": ["frontend", "backend"]
        }
      ]
    }
  ]
}
```

### 12.6 Team Node And Individual Node

The system supports two node types:

```txt
individual
team
```

The distinction is semantic, not based on member count.

Rule:

```txt
If the node represents a work unit / capability entry point, register it as team.
If the node represents a concrete executor / persona / process, register it as individual.
```

Therefore a one-member team is still a team if it represents a work unit.

Example:

```txt
develop-team: team node
annie-dev: individual member node
```

Even if `develop-team` currently has only `annie-dev`, it should remain `node_type: "team"` so it can later grow members without a model migration.

### 12.7 Team Composition

Team membership is represented separately from node identity.

Recommended shape:

```json
{
  "team_node_id": "develop-team",
  "lead_node_id": "annie-pm",
  "routing_mode": "team_decides",
  "members": [
    {
      "node_id": "annie-pm",
      "team_role": "lead",
      "declared_capabilities": ["requirements", "planning"]
    },
    {
      "node_id": "annie-dev",
      "team_role": "developer",
      "declared_capabilities": ["frontend", "backend"]
    }
  ]
}
```

Important constraints:

- A team is a node.
- A member is also a node.
- Team membership does not replace node registration.
- Team relations should come from registration proposal and/or user confirmation.
- Runtime discovery alone must not infer team membership.

### 12.8 Team Routing

Team nodes are externally addressable.

Example:

```json
{
  "from": "annie",
  "to": "develop-team",
  "message_type": "PLANNING_REQUEST"
}
```

The team can then decide how to route internally.

Possible internal messages:

```json
{
  "from": "annie-pm",
  "team_context": {
    "team_node_id": "develop-team",
    "role": "lead"
  },
  "action": "send_message",
  "to": "annie-dev",
  "message_type": "TASK_ASSIGNED",
  "message": "Please implement the homepage."
}
```

The scheduler validates:

1. `annie-pm` is a registered node.
2. `annie-pm` is a member of `develop-team`.
3. The member role allows the requested action.
4. The target node is valid and addressable.
5. The message type is allowed by policy.

### 12.9 Action Policy Is Granted, Not Self-Assigned

Nodes may declare capabilities and request actions, but they do not grant themselves permissions.

Separate:

```txt
declared_capabilities = node's self-description
requested_actions = actions requested by node
granted_actions = actions approved by Annie policy / user / registry rules
```

Agent messages must be self-routed:

```json
{
  "intent_id": "intent_001",
  "from": "develop-team",
  "runtime": "openclaw",
  "action": "send_message",
  "to": "annie",
  "message_type": "REQUIREMENT_CLARIFICATION_REQUEST",
  "message": "网站类型是什么？"
}
```

TaskGraphScheduler validates and delivers. It does not decide the target on behalf of the node.

### 12.10 Runtime-Neutral Routes

Runtime-neutral collaboration endpoints should not include runtime names.

Preferred:

```txt
POST /agent-messages
POST /nodes/register
GET /nodes
POST /nodes/heartbeat
```

Runtime-specific endpoints may still exist for inbound adapters, such as:

```txt
POST /openclaw/messages
```

But the main node collaboration protocol should remain runtime-neutral.

### 12.11 Revised Next Phases

Recommended next phases:

```txt
Phase 16: Node Registry And Team Composition
Phase 17: Runtime Discovery And Candidate Nodes
Phase 18: Node Registration Interview
Phase 19: Team Delegation Actions
Phase 20: Plan Proposal Intake
```

Phase 16 should implement:

1. `RegisteredNode` model.
2. `TeamComposition` model.
3. `NodeRegistrationProposal` schema.
4. `POST /nodes/register`.
5. Registry persistence.
6. Single-member team support.
7. Team context validation boundary.

Phase 16 implementation status:

```txt
done
```

Implemented in Phase 16:

1. `src/node_registry/model.ts` defines and validates registry models.
2. `src/node_registry/registry.ts` persists `.annie/nodes/registry.json`.
3. `POST /nodes/register` registers proposal snapshots.
4. `GET /nodes` returns the registry snapshot.
5. `validateTeamContext` verifies node membership in a claimed team context.
6. `buildAgentActionPolicyFromNodeRegistry` grants actions from active registered nodes.
7. Single-member team composition is supported.

Phase 17 should implement:

1. Runtime detector boundary.
2. OpenClaw discovery adapter.
3. Candidate node list.
4. Discovery metadata persistence.

Phase 17 implementation status:

```txt
done
```

Implemented in Phase 17:

1. `src/runtime_discovery/model.ts` defines runtime and candidate node discovery models.
2. `src/runtime_discovery/store.ts` persists `.annie/discovery/runtime-candidates.json`.
3. `src/runtime_discovery/openclaw_discovery.ts` maps `openclaw agents list --json` output into candidate nodes.
4. OpenClaw discovery failures are represented as unavailable runtime metadata.
5. `GET /nodes/candidates` returns the discovery snapshot.
6. Discovery does not write Node Registry and does not grant actions.

Phase 18 should implement:

1. Registration template.
2. Candidate interview flow.
3. Proposal parsing from runtime replies.
4. User/system approval boundary for granted actions.

Phase 18 implementation status:

```txt
done
```

Implemented in Phase 18:

1. `src/node_registration_interview/template.ts` creates registration interview requests.
2. `src/node_registration_interview/parser.ts` parses object, text, and fenced JSON replies into `NodeRegistrationProposal`.
3. `src/node_registration_interview/approval.ts` applies explicit approval policy.
4. Default registration approval grants no actions.
5. Node Registry no longer copies `requested_actions` into `granted_actions`.
6. Registry-derived action policy only allows explicitly granted actions.

Phase 19 should implement:

1. `delegate_to_member` action.
2. Team-scoped delegation validation.
3. Agent message `team_context` intake.
4. Registry-derived delegation policy.

Phase 19 implementation status:

```txt
done
```

Implemented in Phase 19:

1. `delegate_to_member` is a supported action.
2. Delegation permission allows `TASK_ASSIGNED`.
3. `validateTeamDelegation` checks sender team context, target membership, and action policy.
4. `intakeAgentMessage` can deliver delegation messages to member inboxes.
5. Delegation messages preserve `team_context` in payload.
6. Delegation intake writes mailbox messages and does not mutate workflow state.

Phase 20 should implement:

1. Plan proposal model and parser.
2. TaskDagPlan validation.
3. Plan proposal persistence.
4. Runtime-neutral plan proposal endpoints.

Phase 20 implementation status:

```txt
done
```

Implemented in Phase 20:

1. `src/plan_proposal/parser.ts` parses object, text, and fenced JSON plan proposals.
2. Plan proposal intake reuses existing `loadPlan` / DAG validation.
3. `src/plan_proposal/store.ts` persists `.annie/plans/proposals.json`.
4. `POST /plan-proposals` saves validated proposals.
5. `GET /plan-proposals` returns proposal snapshots.
6. Plan proposal intake does not initialize workflow state.

Phase 21 should implement:

1. Workflow bootstrap model.
2. Bootstrap workflow from plan proposal.
3. Runtime-neutral workflow bootstrap endpoint.
4. Bootstrap audit event.
5. No automatic next-wave or dispatch.

Phase 21 implementation status:

```txt
done
```

Implemented in Phase 21:

1. `src/workflow_bootstrap/bootstrap.ts` bootstraps saved plan proposals into workflow state.
2. `POST /workflow-bootstrap` explicitly triggers bootstrap.
3. Bootstrap writes a `WORKFLOW_BOOTSTRAPPED` audit event.
4. Bootstrap creates pending workflow state without waves.
5. Bootstrap does not automatically dispatch or call OpenClaw.

## 13. Autonomous Execution Roadmap

### 13.1 Roadmap Goal

The remaining product work should turn the current intake/bootstrap foundation into a full autonomous execution loop:

```txt
bootstrapped workflow
  -> schedule next executable wave
  -> dispatch tasks to registered nodes
  -> receive task results
  -> run review gate
  -> advance next wave
  -> pause when human input or permissions are needed
  -> complete with report and memory candidates
```

The loop must preserve the architectural rules already agreed:

1. Nodes decide their own outbound messages and targets.
2. The scheduler validates actions, permissions, and state transitions.
3. Runtime-specific behavior stays behind adapters.
4. OpenClaw is one runtime adapter, not the core collaboration protocol.
5. Agent messages do not directly mutate workflow state.
6. State changes must be persisted and audited.

### 13.2 Phase 22: Workflow Scheduling Loop

Phase 22 should implement the first post-bootstrap step: explicitly schedule the next executable wave from a workflow state.

Scope:

1. Add an autonomous workflow scheduling service that loads workflow state by `workflow_id`.
2. Reuse the existing scheduler to compute the next wave.
3. Persist the generated wave to workflow state.
4. Write an audit event when a wave is scheduled.
5. Return a structured scheduling decision, including no-ready-task and completed-workflow outcomes.
6. Expose both a runtime-neutral endpoint and a CLI command for explicit next-wave scheduling.

Non-goals:

1. Do not dispatch tasks to agents yet.
2. Do not call OpenClaw yet.
3. Do not run as a daemon yet.

Acceptance:

1. A bootstrapped workflow can produce its first wave.
2. A workflow with blocked tasks returns a blocked/no-ready decision without corrupting state.
3. Scheduling is idempotent for an already active wave.
4. Audit logs show when and why a wave was scheduled or skipped.

Phase 22 implementation status:

```txt
done
```

Implemented in Phase 22:

1. `src/workflow_scheduling/model.ts` defines runtime-neutral scheduling decisions.
2. `src/workflow_scheduling/schedule_next_wave.ts` schedules the next wave from workflow state.
3. `POST /workflow-next-wave` triggers explicit next-wave scheduling.
4. Existing `next-wave` CLI uses the workflow scheduling service.
5. Scheduling writes `WORKFLOW_WAVE_SCHEDULED` or skipped scheduling audit events.
6. Scheduling sets `current_wave` but does not dispatch tasks and does not call OpenClaw.

### 13.3 Phase 23: Wave Task Dispatch

Phase 23 should dispatch scheduled wave tasks to registered nodes through the existing mailbox/action policy boundary.

Scope:

1. Load the current active wave.
2. Resolve candidate nodes from Node Registry and task capability requirements.
3. Apply granted action policy and team membership validation.
4. Create `TASK_ASSIGNED` mailbox messages for selected target nodes.
5. Mark dispatched tasks as `assigned` or equivalent dispatch-pending state first, then mark them `running` only after the target node acknowledges the assignment.
6. Audit each dispatch, acknowledgement, state transition, and rejection.

Non-goals:

1. Do not require OpenClaw transport delivery yet.
2. Do not let mailbox delivery directly mutate task state.
3. Do not implement dynamic task creation.

Acceptance:

1. A scheduled wave can be dispatched into node inboxes.
2. Ineligible nodes are rejected with explainable reasons.
3. Tasks without eligible nodes remain pending/blocked with audit evidence.
4. Dispatch can be retried without duplicate task assignment messages.
5. Tasks do not become `running` until assignment acknowledgement is received.

### 13.4 Phase 24: Agent Result Intake

Phase 24 should provide the runtime-neutral path for execution agents to submit structured task results.

Scope:

1. Add task result intake payload parsing.
2. Validate sender node, team context, task assignment, and result schema.
3. Reuse ResultCollector to move tasks to `reviewing`, `failed`, or retry-ready state.
4. Persist submitted result payloads for auditability.
5. Add endpoint or CLI command for result submission.

Non-goals:

1. Do not automatically approve waves.
2. Do not let agents choose final task state directly.
3. Do not add OpenClaw callback integration yet.

Acceptance:

1. A dispatched task can be completed through result intake.
2. A failed task follows existing retry policy.
3. Unauthorized result submissions are rejected.
4. Result intake writes state and audit records.

### 13.5 Phase 25: Review And Wave Advancement

Phase 25 should connect completed wave results to ReviewGate and controlled next-wave progression.

Scope:

1. Detect when all tasks in a wave are ready for review.
2. Run ReviewGate for the active wave.
3. Support reviewer-agent submitted review messages where needed.
4. Allow automatic ReviewGate pass only for purely local deterministic checks; require reviewer-agent review when the wave policy, task risk, changed files, or plan metadata asks for human/agent review.
5. Mark reviewed tasks done when review passes.
6. Pause workflow when review fails, requirements are unclear, or human approval is required.
7. Allow explicit resume after correction or approval.

Non-goals:

1. Do not implement continuous daemon mode yet.
2. Do not add dynamic replanning yet.

Acceptance:

1. Passing review advances workflow state safely.
2. Failing review pauses workflow with a clear reason.
3. Review decisions are audited.
4. A passed wave can be followed by scheduling the next wave.

### 13.6 Phase 26: Runtime Transport Integration

Phase 26 should connect dispatch and result intake to real runtime adapters, starting with OpenClaw.

Scope:

1. Define a runtime transport interface for starting/sending agent work.
2. Implement OpenClaw session spawn/send integration behind the adapter.
3. Add callback or polling adapter for runtime replies.
4. Normalize runtime replies into agent messages or task result submissions.
5. Preserve local/mock transports for tests.
6. Record runtime delivery metadata and failures.

Non-goals:

1. Do not make OpenClaw a required dependency for local tests.
2. Do not hard-code OpenClaw route names into the core workflow.

Acceptance:

1. Dispatch can send work to a real OpenClaw-backed node when configured.
2. Runtime reply can be converted into a mailbox message or task result.
3. Runtime failure pauses or retries according to policy.
4. Tests cover adapter behavior through injected runners.

### 13.7 Phase 27: Autonomous Runner

Phase 27 should add the controlled loop that repeatedly advances the workflow until it completes or reaches a pause condition.

Scope:

1. Add a workflow runner service.
2. Runner steps: schedule, dispatch, wait for results, review, advance.
3. Add loop stop conditions: completed, blocked, waiting_for_user, waiting_for_review, failed, missing_permission.
4. Start with explicit step-by-step runner controls for the first implementation.
5. Add start/stop/resume controls after step execution is stable.
6. Add bounded polling or event-driven wakeup after the explicit runner proves the happy path.
7. Persist runner status and audit each loop decision.

Non-goals:

1. Do not silently bypass human clarification.
2. Do not auto-grant missing permissions.
3. Do not auto-create new tasks without an approved replanning path.

Acceptance:

1. A simple multi-wave workflow can run to completion with mock agents.
2. Runner pauses instead of guessing when input is missing.
3. Runner can resume after user approval or new result intake.
4. Runner state survives process restart.
5. The first runner implementation can execute one explicit step at a time for debugging and auditability.

### 13.8 Phase 28: Dynamic Replanning And Human Clarification

Phase 28 should support controlled changes to the plan while a workflow is active. Dynamic replanning should wait until the basic autonomous happy path is working through scheduling, dispatch, result intake, review, and runner steps.

Scope:

1. Add a replanning request message type.
2. Allow authorized nodes to propose task additions or plan revisions.
3. Validate proposed changes against DAG and workflow state constraints.
4. Require explicit approval before mutating an active plan.
5. Add user clarification request/response state.
6. Audit old plan, proposed plan, approval, and applied plan.

Non-goals:

1. Do not allow arbitrary agents to rewrite active workflow state.
2. Do not hide plan changes inside normal chat messages.

Acceptance:

1. A blocked workflow can request clarification and pause.
2. User clarification can resume the workflow.
3. Authorized replanning proposals can be validated and approved.
4. Rejected proposals leave the active plan unchanged.

### 13.9 Phase 29: Observability, Reports, And Memory

Phase 29 should make the autonomous loop inspectable and useful after completion.

Scope:

1. Add workflow run timeline projection.
2. Add node-level activity and failure summaries.
3. Extend final report for autonomous runs.
4. Extract memory candidates from successful autonomous workflows.
5. Add diagnostics for stuck workflows.
6. Add operational docs for local and OpenClaw-backed runs.

Acceptance:

1. A user can see what happened, who did what, and why the workflow paused or completed.
2. Reports include task, wave, node, message, review, and runtime transport summaries.
3. Memory extraction works for autonomous workflow outcomes.

### 13.10 Open Decisions Before Implementation

The following product decisions have been confirmed:

1. Phase 22 should expose both an endpoint and a CLI command.
2. Dispatch should not immediately mark a task as `running`; it should wait for target node acknowledgement.
3. ReviewGate may automatically pass only deterministic local checks; reviewer-agent review is required when policy or risk calls for it.
4. The first runner should be explicit step-by-step. Polling or event-driven loop should come after the happy path is debuggable.
5. Dynamic replanning should wait until the first complete autonomous happy path exists.

The following decision remains intentionally deferred until implementation reaches Phase 26:

1. What exact OpenClaw execution API should be used for task dispatch and result collection in the target environment.
