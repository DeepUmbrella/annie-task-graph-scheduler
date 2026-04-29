import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { inboundLogPath, receiveInboundPayload } from "../src/server/inbound_server.js";

test("receiveInboundPayload writes OpenClaw messages to the inbound log", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "annie-tgs-inbound-"));
  const logPath = inboundLogPath(rootDir);

  const record = await receiveInboundPayload({
    type: "USER_MESSAGE",
    from: "openclaw",
    to: "annie",
    message: "Create a website"
  }, {
    logPath,
    path: "/openclaw/messages",
    now: () => "2026-04-28T12:00:00.000Z"
  });

  assert.equal(record.received_at, "2026-04-28T12:00:00.000Z");
  assert.equal(record.path, "/openclaw/messages");

  const rawLog = await readFile(logPath, "utf8");
  const records = rawLog
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as {
      received_at: string;
      source: string;
      path: string;
      payload: { message: string };
    });

  assert.equal(records.length, 1);
  assert.equal(records[0]?.received_at, "2026-04-28T12:00:00.000Z");
  assert.equal(records[0]?.source, "openclaw");
  assert.equal(records[0]?.path, "/openclaw/messages");
  assert.equal(records[0]?.payload.message, "Create a website");
});
