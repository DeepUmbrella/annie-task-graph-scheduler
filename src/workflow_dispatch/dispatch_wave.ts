import type { AuditEvent } from "../models/audit.js";
import type { Message } from "../models/message.js";
import type { WorkflowState } from "../models/workflow.js";
import { createMessageBus } from "../communication/message_bus.js";
import { createMailboxStore, type MailboxStore } from "../communication/mailbox_store.js";
import { createNodeRegistry, type NodeRegistry } from "../node_registry/index.js";
import { createStateStore, type StateStore } from "../storage/state_store.js";
import type {
  WorkflowDispatchAssignment,
  WorkflowDispatchDecision,
  WorkflowDispatchInput,
  WorkflowDispatchResult
} from "./model.js";
import { selectDispatchTargets } from "./selection.js";

export interface DispatchWorkflowWaveOptions {
  rootDir?: string;
  stateStore?: StateStore;
  nodeRegistry?: NodeRegistry;
  mailboxStore?: MailboxStore;
  now?: string;
}

export async function dispatchWorkflowWave(
  input: WorkflowDispatchInput,
  options: DispatchWorkflowWaveOptions = {}
): Promise<WorkflowDispatchResult> {
  const now = options.now ?? new Date().toISOString();
  const stateStore = options.stateStore ?? createStateStore(options.rootDir);
  const nodeRegistry = options.nodeRegistry ?? createNodeRegistry(options.rootDir);
  const mailboxStore = options.mailboxStore ?? createMailboxStore(options.rootDir);
  const state = await stateStore.loadState(input.workflow_id);
  const registry = await nodeRegistry.loadSnapshot();
  const selection = selectDispatchTargets({
    state,
    registry,
    wave_id: input.wave_id
  });

  if (!selection.wave_id) {
    const decision = createDecision(state, null, {
      status: "no_active_wave",
      reason: "Workflow has no active wave to dispatch.",
      dispatchedTaskIds: [],
      rejectedTaskIds: [],
      alreadyDispatchedTaskIds: []
    });
    await stateStore.appendAuditEvent(createDispatchAuditEvent(state.workflow_id, "WORKFLOW_DISPATCH_SKIPPED", now, {
      decision
    }));
    return createResult(state, stateStore, decision, [], [], []);
  }

  const assignments: WorkflowDispatchAssignment[] = [];
  const messages: Message[] = [];
  const alreadyDispatchedTaskIds = selection.selections
    .filter((candidate) => candidate.decision === "already_assigned")
    .map((candidate) => candidate.task_id);
  let nextState: WorkflowState = state;

  const messageBus = createMessageBus({
    mailbox_store: mailboxStore
  });

  for (const selected of selection.selections.filter((candidate) => candidate.decision !== "already_assigned")) {
    const task = nextState.tasks[selected.task_id];
    if (!task) {
      continue;
    }

    const message = messageBus.createMessage({
      workflow_id: nextState.workflow_id,
      task_id: selected.task_id,
      wave_id: selection.wave_id,
      from: "orchestrator",
      to: selected.node_id,
      type: "TASK_ASSIGNED",
      requires_ack: true,
      created_at: now,
      payload: {
        task_id: selected.task_id,
        wave_id: selection.wave_id,
        title: task.title,
        description: task.description,
        expected_files: task.expected_files,
        required_capabilities: task.required_capabilities,
        assignment_decision: selected.decision
      }
    });
    const delivered = await messageBus.sendMessage(message);
    messages.push(delivered);
    assignments.push({
      task_id: selected.task_id,
      node_id: selected.node_id,
      message_id: delivered.message_id,
      inbox_path: mailboxStore.mailboxPath(nextState.workflow_id, selected.node_id, "inbox"),
      decision: selected.decision
    });
    nextState = {
      ...nextState,
      tasks: {
        ...nextState.tasks,
        [selected.task_id]: {
          ...task,
          status: "assigned",
          assigned_to: selected.node_id
        }
      },
      updated_at: now
    };
  }

  if (assignments.length > 0) {
    await stateStore.saveState(nextState);
  }

  const decision = createDecision(nextState, selection.wave_id, {
    status: getDecisionStatus(assignments.length, selection.rejections.length, alreadyDispatchedTaskIds.length),
    reason: createDecisionReason(assignments.length, selection.rejections.length, alreadyDispatchedTaskIds.length),
    dispatchedTaskIds: assignments.map((assignment) => assignment.task_id),
    rejectedTaskIds: selection.rejections.map((rejection) => rejection.task_id),
    alreadyDispatchedTaskIds
  });

  await appendDispatchAuditEvents(stateStore, nextState.workflow_id, now, decision, assignments, selection.rejections);

  return createResult(nextState, stateStore, decision, assignments, selection.rejections, messages);
}

function createResult(
  state: WorkflowState,
  stateStore: StateStore,
  decision: WorkflowDispatchDecision,
  assignments: WorkflowDispatchResult["assignments"],
  rejections: WorkflowDispatchResult["rejections"],
  messages: Message[]
): WorkflowDispatchResult {
  return {
    workflow_id: state.workflow_id,
    wave_id: decision.wave_id,
    decision,
    assignments,
    rejections,
    messages,
    state,
    state_path: stateStore.statePath(state.workflow_id),
    audit_path: stateStore.auditPath(state.workflow_id)
  };
}

function createDecision(
  state: WorkflowState,
  waveId: string | null,
  options: {
    status: WorkflowDispatchDecision["status"];
    reason: string;
    dispatchedTaskIds: string[];
    rejectedTaskIds: string[];
    alreadyDispatchedTaskIds: string[];
  }
): WorkflowDispatchDecision {
  return {
    status: options.status,
    reason: options.reason,
    workflow_id: state.workflow_id,
    wave_id: waveId,
    dispatched_task_ids: options.dispatchedTaskIds,
    rejected_task_ids: options.rejectedTaskIds,
    already_dispatched_task_ids: options.alreadyDispatchedTaskIds
  };
}

function getDecisionStatus(
  assignmentCount: number,
  rejectionCount: number,
  alreadyDispatchedCount: number
): WorkflowDispatchDecision["status"] {
  if (assignmentCount > 0 && rejectionCount > 0) {
    return "partially_dispatched";
  }
  if (assignmentCount > 0) {
    return "dispatched";
  }
  if (alreadyDispatchedCount > 0 && rejectionCount === 0) {
    return "already_dispatched";
  }
  return "no_dispatchable_tasks";
}

function createDecisionReason(
  assignmentCount: number,
  rejectionCount: number,
  alreadyDispatchedCount: number
): string {
  if (assignmentCount > 0 && rejectionCount > 0) {
    return `Dispatched ${assignmentCount} task(s); ${rejectionCount} task(s) were rejected.`;
  }
  if (assignmentCount > 0) {
    return `Dispatched ${assignmentCount} task(s).`;
  }
  if (alreadyDispatchedCount > 0 && rejectionCount === 0) {
    return "All dispatchable tasks were already assigned.";
  }
  return "No tasks were dispatchable.";
}

async function appendDispatchAuditEvents(
  stateStore: StateStore,
  workflowId: string,
  now: string,
  decision: WorkflowDispatchDecision,
  assignments: WorkflowDispatchAssignment[],
  rejections: WorkflowDispatchResult["rejections"]
): Promise<void> {
  for (const assignment of assignments) {
    await stateStore.appendAuditEvent(createDispatchAuditEvent(workflowId, "TASK_DISPATCHED", now, {
      task_id: assignment.task_id,
      wave_id: decision.wave_id,
      node_id: assignment.node_id,
      message_id: assignment.message_id,
      decision: assignment.decision
    }));
    await stateStore.appendAuditEvent(createDispatchAuditEvent(workflowId, "TASK_STATUS_CHANGED", now, {
      task_id: assignment.task_id,
      from: "ready",
      to: "assigned",
      reason: "Task assignment message delivered to node inbox.",
      source: "workflow_dispatch"
    }));
  }

  for (const rejection of rejections) {
    await stateStore.appendAuditEvent(createDispatchAuditEvent(workflowId, "TASK_DISPATCH_REJECTED", now, {
      task_id: rejection.task_id,
      code: rejection.code,
      reason: rejection.reason
    }));
  }

  await stateStore.appendAuditEvent(createDispatchAuditEvent(workflowId, "WORKFLOW_DISPATCH_DECIDED", now, {
    decision
  }));
}

function createDispatchAuditEvent(
  workflowId: string,
  type: string,
  now: string,
  payload: Record<string, unknown>
): AuditEvent {
  return {
    event_id: `evt_${Date.parse(now)}_${type.toLowerCase()}_${Math.random().toString(36).slice(2, 10)}`,
    workflow_id: workflowId,
    type,
    payload,
    created_at: now
  };
}
