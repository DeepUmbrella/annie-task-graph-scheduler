import { createMailboxStore, type MailboxStore } from "../communication/mailbox_store.js";
import { createMessageBus } from "../communication/message_bus.js";
import type { TransportAdapter } from "../communication/openclaw_adapter.js";
import type { Message } from "../models/message.js";
import type { WorkflowIntent } from "../intake/index.js";
import { findControllerAgent, type TeamSnapshot } from "../team/index.js";
import { TaskGraphSchedulerError } from "../errors.js";

export interface PlannerHandoffOptions {
  rootDir?: string;
  mailboxStore?: MailboxStore;
  transport?: TransportAdapter;
  now?: string;
}

export interface PlannerHandoffResult {
  message: Message;
  planner_agent_id: string;
  planner_inbox_path: string;
  orchestrator_outbox_path: string;
}

export async function handoffIntentToPlanner(
  intent: WorkflowIntent,
  team: TeamSnapshot,
  options: PlannerHandoffOptions = {}
): Promise<PlannerHandoffResult> {
  const planner = findControllerAgent(team);
  if (!planner) {
    throw new TaskGraphSchedulerError("Team does not have a controller agent for planning.", "TEAM_CONTROLLER_NOT_FOUND", {
      team_id: team.team_id
    });
  }

  const rootDir = options.rootDir ?? ".annie";
  const mailboxStore = options.mailboxStore ?? createMailboxStore(rootDir);
  const bus = createMessageBus({
    mailbox_store: mailboxStore,
    transport: options.transport
  });
  const message = bus.createMessage({
    workflow_id: intent.intent_id,
    task_id: "planning",
    wave_id: "planning",
    from: "orchestrator",
    to: planner.agent_id,
    type: "PLANNING_REQUEST",
    priority: "high",
    payload: {
      intent_id: intent.intent_id,
      goal: intent.goal,
      team_id: team.team_id,
      required_output: "TaskDagPlan"
    },
    created_at: options.now ?? intent.created_at
  });
  const delivered = await bus.sendMessage(message);

  return {
    message: delivered,
    planner_agent_id: planner.agent_id,
    planner_inbox_path: mailboxStore.mailboxPath(intent.intent_id, planner.agent_id, "inbox"),
    orchestrator_outbox_path: mailboxStore.mailboxPath(intent.intent_id, "orchestrator", "outbox")
  };
}
