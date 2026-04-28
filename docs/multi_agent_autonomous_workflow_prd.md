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

Not yet implemented:

- reading real OpenClaw config into a team snapshot
- planner/team controller request flow
- autonomous orchestration loop
- real OpenClaw `sessions_spawn` / `sessions_send` integration
- team-scoped permission-aware message validation
- user approval/clarification loop

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
