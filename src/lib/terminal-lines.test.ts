import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeTerminalChunk } from "./terminal-lines.ts";

test("strips trailing CR from CRLF chunks", () => {
  const { lines, pending } = normalizeTerminalChunk(
    "line1\r\nline2\r\nline3\r\n",
    "",
  );
  assert.deepEqual(lines, ["line1", "line2", "line3", ""]);
  assert.equal(pending, "");
});

test("bare CR without newline is preserved (not split)", () => {
  const { lines, pending } = normalizeTerminalChunk("line1\rline2\rline3", "");
  assert.deepEqual(lines, ["line1\rline2\rline3"]);
  assert.equal(pending, "");
});

test("handles empty chunk", () => {
  const { lines, pending } = normalizeTerminalChunk("", "");
  assert.deepEqual(lines, [""]);
  assert.equal(pending, "");
});

test("handles mixed line endings", () => {
  const { lines, pending } = normalizeTerminalChunk(
    "line1\r\nline2\rline3\nline4",
    "",
  );
  assert.deepEqual(lines, ["line1", "line2\rline3", "line4"]);
  assert.equal(pending, "");
});

test("empty lines are preserved after stripping CR", () => {
  const { lines, pending } = normalizeTerminalChunk("line1\r\n\r\nline2", "");
  assert.deepEqual(lines, ["line1", "", "line2"]);
  assert.equal(pending, "");
});

test("does not strip leading or internal CR before a newline", () => {
  const { lines, pending } = normalizeTerminalChunk("a\rb\r\nc", "");
  assert.deepEqual(lines, ["a\rb", "c"]);
  assert.equal(pending, "");
});

test("buffers incomplete CSI at end of chunk", () => {
  const { lines, pending } = normalizeTerminalChunk("hello\x1b[38;5;14", "");
  assert.deepEqual(lines, ["hello"]);
  assert.equal(pending, "\x1b[38;5;14");
});

test("buffers partial CSI prefix (ESC+[, no params)", () => {
  const { lines, pending } = normalizeTerminalChunk("hello\x1b[", "");
  assert.deepEqual(lines, ["hello"]);
  assert.equal(pending, "\x1b[");
});

test("prepends pending incomplete CSI to next chunk", () => {
  const { lines, pending } = normalizeTerminalChunk("mworld\n", "\x1b[38;5;14");
  assert.deepEqual(lines, ["\x1b[38;5;14mworld", ""]);
  assert.equal(pending, "");
});

test("incomplete CSI without newline stays in pending", () => {
  const { lines, pending } = normalizeTerminalChunk("\x1b[31", "");
  assert.deepEqual(lines, []);
  assert.equal(pending, "\x1b[31");
});

test("complete SGR at end is not buffered", () => {
  const { lines, pending } = normalizeTerminalChunk("hello\x1b[31m", "");
  assert.deepEqual(lines, ["hello\x1b[31m"]);
  assert.equal(pending, "");
});

test("incomplete CSI at end of a complete line is buffered", () => {
  const { lines, pending } = normalizeTerminalChunk(
    "hello\x1b[38;5;14\nworld\n",
    "",
  );
  assert.deepEqual(lines, ["hello", "world", ""]);
  assert.equal(pending, "\x1b[38;5;14");
});

test("buffers standalone ESC at end of chunk", () => {
  const { lines, pending } = normalizeTerminalChunk("hello\x1b", "");
  assert.deepEqual(lines, ["hello"]);
  assert.equal(pending, "\x1b");
});

test("buffers standalone ESC at end of a complete line", () => {
  const { lines, pending } = normalizeTerminalChunk("hello\x1b\nworld\n", "");
  assert.deepEqual(lines, ["hello", "world", ""]);
  assert.equal(pending, "\x1b");
});

test("prepends pending ESC to next chunk forming valid SGR", () => {
  const { lines, pending } = normalizeTerminalChunk("[mworld\n", "\x1b");
  assert.deepEqual(lines, ["\x1b[mworld", ""]);
  assert.equal(pending, "");
});

test("recursive: trimmed line with trailing incomplete CSI is re-checked", () => {
  const { lines, pending } = normalizeTerminalChunk(
    "a\x1b[38;5;14\x1b[31\nb\n",
    "",
  );
  assert.deepEqual(lines, ["a", "b", ""]);
  assert.equal(pending, "\x1b[38;5;14\x1b[31");
});

test("recursive: trimmed line with trailing ESC is re-checked", () => {
  const { lines, pending } = normalizeTerminalChunk("a\x1b\nb\n", "");
  assert.deepEqual(lines, ["a", "b", ""]);
  assert.equal(pending, "\x1b");
});

test("pending is not lost between sequential chunks", () => {
  let { lines: l1, pending: p1 } = normalizeTerminalChunk(
    "hello\x1b[38;5;14",
    "",
  );
  assert.deepEqual(l1, ["hello"]);
  assert.equal(p1, "\x1b[38;5;14");

  // The "m" completes the SGR — it should be output, not buffered.
  let { lines: l2, pending: p2 } = normalizeTerminalChunk("m", p1);
  assert.deepEqual(l2, ["\x1b[38;5;14m"]);
  assert.equal(p2, "");

  let { lines: l3, pending: p3 } = normalizeTerminalChunk("world\n", "");
  assert.deepEqual(l3, ["world", ""]);
  assert.equal(p3, "");
});
