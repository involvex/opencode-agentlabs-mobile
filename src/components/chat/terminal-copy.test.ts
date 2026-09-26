import { test } from "node:test";
import assert from "node:assert/strict";
import { buildTerminalMenuOptions, parseOutbound } from "./terminal-copy.ts";

test("parseOutbound accepts longpress with selection", () => {
  const msg = parseOutbound(
    JSON.stringify({ type: "longpress", data: "ls -la", hasSelection: true }),
  );
  assert.deepEqual(msg, {
    type: "longpress",
    data: "ls -la",
    hasSelection: true,
  });
});

test("parseOutbound accepts longpress without selection", () => {
  const msg = parseOutbound(
    JSON.stringify({ type: "longpress", data: "", hasSelection: false }),
  );
  assert.deepEqual(msg, {
    type: "longpress",
    data: "",
    hasSelection: false,
  });
});

test("parseOutbound accepts buffer payload", () => {
  const msg = parseOutbound(
    JSON.stringify({ type: "buffer", data: "$ ls\nfoo\n" }),
  );
  assert.deepEqual(msg, { type: "buffer", data: "$ ls\nfoo\n" });
});

test("parseOutbound accepts selection payload", () => {
  const msg = parseOutbound(
    JSON.stringify({ type: "selection", data: "foo", hasSelection: true }),
  );
  assert.deepEqual(msg, {
    type: "selection",
    data: "foo",
    hasSelection: true,
  });
});

test("parseOutbound rejects longpress with bad shapes", () => {
  assert.equal(
    parseOutbound(JSON.stringify({ type: "longpress", data: "x" })),
    null,
  );
  assert.equal(
    parseOutbound(
      JSON.stringify({ type: "longpress", data: 42, hasSelection: true }),
    ),
    null,
  );
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

test("menu shows copy, copy-all and paste when text is selected", () => {
  assert.deepEqual(buildTerminalMenuOptions(true), [
    "copy",
    "copy-all",
    "paste",
  ]);
});

test("menu shows copy-all and paste without selection", () => {
  assert.deepEqual(buildTerminalMenuOptions(false), ["copy-all", "paste"]);
});
