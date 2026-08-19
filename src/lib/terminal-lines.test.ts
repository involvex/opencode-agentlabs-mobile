import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeTerminalChunk } from "./terminal-lines.ts";

test("strips trailing CR from CRLF chunks", () => {
  const out = normalizeTerminalChunk("line1\r\nline2\r\nline3\r\n");
  assert.deepEqual(out, ["line1", "line2", "line3", ""]);
});

test("bare CR without newline is preserved (not split)", () => {
  const out = normalizeTerminalChunk("line1\rline2\rline3");
  assert.deepEqual(out, ["line1\rline2\rline3"]);
});

test("handles empty chunk", () => {
  const out = normalizeTerminalChunk("");
  assert.deepEqual(out, [""]);
});

test("handles mixed line endings", () => {
  const out = normalizeTerminalChunk("line1\r\nline2\rline3\nline4");
  assert.deepEqual(out, ["line1", "line2\rline3", "line4"]);
});

test("empty lines are preserved after stripping CR", () => {
  const out = normalizeTerminalChunk("line1\r\n\r\nline2");
  assert.deepEqual(out, ["line1", "", "line2"]);
});

test("does not strip leading or internal CR before a newline", () => {
  const out = normalizeTerminalChunk("a\rb\r\nc");
  assert.deepEqual(out, ["a\rb", "c"]);
});
