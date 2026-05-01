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

Not yet implemented:

- reading real OpenClaw config into a team snapshot
- planner/team controller request flow
- autonomous orchestration loop
- real OpenClaw `sessions_spawn` / `sessions_send` integration
- team-scoped permission-aware message validation
- user approval/clarification loop
- candidate node interview flow

## 10. Suggested Next Phase

Recommended next phase:

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
