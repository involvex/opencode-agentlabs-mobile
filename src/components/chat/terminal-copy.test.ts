import { test } from "node:test";
import assert from "node:assert/strict";
import { parseOutbound } from "./terminal-copy.ts";

test("parseOutbound accepts copy with text", () => {
  const msg = parseOutbound(JSON.stringify({ type: "copy", data: "ls -la" }));
  assert.deepEqual(msg, { type: "copy", data: "ls -la" });
});

test("parseOutbound accepts paste-request", () => {
  assert.deepEqual(parseOutbound(JSON.stringify({ type: "paste-request" })), {
    type: "paste-request",
  });
});

test("parseOutbound rejects copy with bad shapes", () => {
  assert.equal(parseOutbound(JSON.stringify({ type: "copy" })), null);
  assert.equal(parseOutbound(JSON.stringify({ type: "copy", data: 42 })), null);
  assert.equal(parseOutbound("not json"), null);
});

test("parseOutbound still handles legacy messages", () => {
  assert.deepEqual(parseOutbound(JSON.stringify({ type: "ready" })), {
    type: "ready",
  });
  assert.deepEqual(
    parseOutbound(JSON.stringify({ type: "input", data: "x" })),
    { type: "input", data: "x" },
  );
  assert.deepEqual(
    parseOutbound(JSON.stringify({ type: "error", message: "boom" })),
    { type: "error", message: "boom" },
  );
});
