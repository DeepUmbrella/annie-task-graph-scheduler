import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createRuntimeDiscoveryStore,
  emptyRuntimeDiscoverySnapshot,
  normalizeRuntimeDiscoverySnapshot
} from "../src/runtime_discovery/index.js";
import { TaskGraphSchedulerError } from "../src/errors.js";

test("normalizes runtime discovery snapshots with candidates", () => {
  const snapshot = normalizeRuntimeDiscoverySnapshot({
    runtimes: [
      {
        runtime: "openclaw",
        status: "available",
        discovered_at: "2026-05-01T00:00:00.000Z",
        command: "openclaw agents list --json"
      }
    ],
    candidates: [
      {
        candidate_id: "openclaw:develop-team",
        runtime: "openclaw",
        runtime_ref: {
          agent_id: "develop-team"
        },
        node_id_hint: "develop-team",
        node_type_hint: "team",
        display_name: "Develop Team",
        declared_capabilities: ["planning", "planning", " delivery "],
        requested_actions: ["send_message"],
        discovered_at: "2026-05-01T00:00:00.000Z"
      }
    ]
  }, "2026-05-01T00:00:00.000Z");

  assert.equal(snapshot.runtimes.length, 1);
  assert.equal(snapshot.candidates.length, 1);
  assert.equal(snapshot.candidates[0]?.candidate_id, "openclaw:develop-team");
  assert.equal(snapshot.candidates[0]?.node_type_hint, "team");
  assert.deepEqual(snapshot.candidates[0]?.declared_capabilities, ["delivery", "planning"]);
  assert.deepEqual(snapshot.candidates[0]?.requested_actions, ["send_message"]);
  assert.equal("granted_actions" in (snapshot.candidates[0] ?? {}), false);
});

test("normalizes unavailable runtime discovery metadata", () => {
  const snapshot = normalizeRuntimeDiscoverySnapshot({
    runtimes: [
      {
        runtime: "openclaw",
        status: "unavailable",
        discovered_at: "2026-05-01T00:00:00.000Z",
        error: "command not found"
      }
    ]
  }, "2026-05-01T00:00:00.000Z");

  assert.equal(snapshot.runtimes[0]?.status, "unavailable");
  assert.equal(snapshot.runtimes[0]?.error, "command not found");
  assert.equal(snapshot.candidates.length, 0);
});

test("emptyRuntimeDiscoverySnapshot returns no candidates", () => {
  const snapshot = emptyRuntimeDiscoverySnapshot();

  assert.equal(snapshot.version, 1);
  assert.equal(snapshot.runtimes.length, 0);
  assert.equal(snapshot.candidates.length, 0);
  assert.equal(snapshot.updated_at, null);
});

test("runtime discovery rejects invalid candidate node types", () => {
  assert.throws(
    () => normalizeRuntimeDiscoverySnapshot({
      candidates: [
        {
          candidate_id: "openclaw:bad",
          runtime: "openclaw",
          node_id_hint: "bad",
          node_type_hint: "service" as "team",
          declared_capabilities: [],
          requested_actions: [],
          discovered_at: "2026-05-01T00:00:00.000Z"
        }
      ]
    }),
    (error) => error instanceof TaskGraphSchedulerError
      && error.code === "CANDIDATE_NODE_TYPE_HINT_INVALID"
  );
});

test("runtime discovery store returns empty snapshot when file does not exist", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "annie-runtime-discovery-"));
  const store = createRuntimeDiscoveryStore(rootDir);

  const snapshot = await store.loadSnapshot();

  assert.equal(snapshot.version, 1);
  assert.equal(snapshot.runtimes.length, 0);
  assert.equal(snapshot.candidates.length, 0);
  assert.equal(snapshot.updated_at, null);
});

test("runtime discovery store saves and reads candidates", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "annie-runtime-discovery-"));
  const store = createRuntimeDiscoveryStore(rootDir);

  await store.saveDiscovery({
    runtimes: [
      {
        runtime: "openclaw",
        status: "available",
        discovered_at: "2026-05-01T01:00:00.000Z"
      }
    ],
    candidates: [
      {
        candidate_id: "openclaw:annie-dev",
        runtime: "openclaw",
        runtime_ref: {
          agent_id: "annie-dev"
        },
        node_id_hint: "annie-dev",
        node_type_hint: "individual",
        declared_capabilities: ["frontend"],
        requested_actions: ["send_message"],
        discovered_at: "2026-05-01T01:00:00.000Z"
      }
    ]
  }, { now: "2026-05-01T01:00:00.000Z" });

  const raw = await readFile(store.snapshotPath(), "utf8");
  const persisted = JSON.parse(raw);
  const snapshot = await store.loadSnapshot();

  assert.equal(persisted.candidates.length, 1);
  assert.equal(snapshot.runtimes[0]?.runtime, "openclaw");
  assert.equal(snapshot.candidates[0]?.candidate_id, "openclaw:annie-dev");
  assert.equal(snapshot.updated_at, "2026-05-01T01:00:00.000Z");
});
