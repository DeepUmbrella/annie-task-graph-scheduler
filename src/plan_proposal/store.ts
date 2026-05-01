import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { TaskGraphSchedulerError } from "../errors.js";
import type { PlanProposal, PlanProposalIntakePayload } from "./model.js";

export interface PlanProposalSnapshot {
  version: 1;
  proposals: PlanProposal[];
  updated_at: string | null;
}

export interface PlanProposalStore {
  proposalsPath(): string;
  saveProposal(payload: PlanProposalIntakePayload, options?: PlanProposalWriteOptions): Promise<PlanProposal>;
  listProposals(): Promise<PlanProposal[]>;
  loadSnapshot(): Promise<PlanProposalSnapshot>;
}

export interface PlanProposalWriteOptions {
  now?: string;
}

export function createPlanProposalStore(rootDir = ".annie"): PlanProposalStore {
  return new FilePlanProposalStore(rootDir);
}

class FilePlanProposalStore implements PlanProposalStore {
  constructor(private readonly rootDir: string) {}

  proposalsPath(): string {
    return join(this.rootDir, "plans", "proposals.json");
  }

  async saveProposal(payload: PlanProposalIntakePayload, options: PlanProposalWriteOptions = {}): Promise<PlanProposal> {
    const snapshot = await this.loadSnapshot();
    const receivedAt = options.now ?? new Date().toISOString();
    const proposal: PlanProposal = {
      proposal_id: `proposal_${Date.parse(receivedAt)}_${payload.plan.plan_id}`,
      intent_id: payload.intent_id,
      from: payload.from,
      runtime: payload.runtime,
      received_at: receivedAt,
      plan: payload.plan,
      validation_status: "valid"
    };

    await this.saveSnapshot({
      version: 1,
      proposals: sortProposals([...snapshot.proposals, proposal]),
      updated_at: receivedAt
    });

    return proposal;
  }

  async listProposals(): Promise<PlanProposal[]> {
    const snapshot = await this.loadSnapshot();
    return sortProposals(snapshot.proposals);
  }

  async loadSnapshot(): Promise<PlanProposalSnapshot> {
    try {
      const raw = await readFile(this.proposalsPath(), "utf8");
      const parsed = JSON.parse(raw) as PlanProposalSnapshot;
      return {
        version: 1,
        proposals: sortProposals(parsed.proposals ?? []),
        updated_at: parsed.updated_at ?? null
      };
    } catch (error) {
      if (isNotFoundError(error)) {
        return emptySnapshot();
      }

      throw new TaskGraphSchedulerError("Failed to load plan proposal snapshot.", "PLAN_PROPOSAL_LOAD_FAILED", {
        path: this.proposalsPath(),
        cause: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private async saveSnapshot(snapshot: PlanProposalSnapshot): Promise<void> {
    await mkdir(join(this.rootDir, "plans"), { recursive: true });

    const proposalsPath = this.proposalsPath();
    const tempPath = `${proposalsPath}.tmp`;
    await writeFile(tempPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
    await rename(tempPath, proposalsPath);
  }
}

function emptySnapshot(): PlanProposalSnapshot {
  return {
    version: 1,
    proposals: [],
    updated_at: null
  };
}

function sortProposals(proposals: PlanProposal[]): PlanProposal[] {
  return [...proposals].sort((a, b) => a.proposal_id.localeCompare(b.proposal_id));
}

function isNotFoundError(error: unknown): boolean {
  return typeof error === "object"
    && error !== null
    && "code" in error
    && (error as { code?: string }).code === "ENOENT";
}
