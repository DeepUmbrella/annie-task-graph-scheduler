import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Message } from "../models/message.js";

export type MailboxName = "inbox" | "outbox";

export interface MailboxStore {
  mailboxDir(workflowId: string, agentId: string): string;
  mailboxPath(workflowId: string, agentId: string, mailbox: MailboxName): string;
  appendMessage(workflowId: string, agentId: string, mailbox: MailboxName, message: Message): Promise<void>;
  readMessages(workflowId: string, agentId: string, mailbox: MailboxName): Promise<Message[]>;
}

export function createMailboxStore(rootDir = ".annie"): MailboxStore {
  return new JsonlMailboxStore(rootDir);
}

class JsonlMailboxStore implements MailboxStore {
  constructor(private readonly rootDir: string) {}

  mailboxDir(workflowId: string, agentId: string): string {
    return join(this.rootDir, "workflows", workflowId, "mailboxes", agentId);
  }

  mailboxPath(workflowId: string, agentId: string, mailbox: MailboxName): string {
    return join(this.mailboxDir(workflowId, agentId), `${mailbox}.jsonl`);
  }

  async appendMessage(workflowId: string, agentId: string, mailbox: MailboxName, message: Message): Promise<void> {
    await mkdir(this.mailboxDir(workflowId, agentId), { recursive: true });
    await writeFile(this.mailboxPath(workflowId, agentId, mailbox), `${JSON.stringify(message)}\n`, {
      encoding: "utf8",
      flag: "a"
    });
  }

  async readMessages(workflowId: string, agentId: string, mailbox: MailboxName): Promise<Message[]> {
    try {
      const raw = await readFile(this.mailboxPath(workflowId, agentId, mailbox), "utf8");
      return raw
        .split("\n")
        .filter((line) => line.trim().length > 0)
        .map((line) => JSON.parse(line) as Message);
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") {
        return [];
      }

      throw error;
    }
  }
}
