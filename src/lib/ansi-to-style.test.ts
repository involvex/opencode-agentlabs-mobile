import { test } from "node:test";
import assert from "node:assert/strict";
import { ansiToSegments } from "./ansi-to-style.ts";

test("empty input returns single default segment", () => {
  const segs = ansiToSegments("", false);
  assert.equal(segs.length, 1);
  assert.equal(segs[0].text, "");
});

test("plain text passes through as one segment", () => {
  const segs = ansiToSegments("hello world", false);
  assert.equal(segs.length, 1);
  assert.equal(segs[0].text, "hello world");
});

test("SGR 31 produces red segment", () => {
  const segs = ansiToSegments("\x1b[31mred\x1b[0m", false);
  assert.equal(segs.length, 1);
  assert.equal(segs[0].text, "red");
  assert.equal(segs[0].style.color, "#cd3131");
});

test("SGR 1;31 produces bold red segment", () => {
  const segs = ansiToSegments("\x1b[1;31mbold red\x1b[0m", false);
  assert.equal(segs.length, 1);
  assert.equal(segs[0].text, "bold red");
  assert.equal(segs[0].style.color, "#cd3131");
  assert.equal(segs[0].style.fontWeight, "700");
});

test("DEC private mode ?900h is stripped", () => {
  const segs = ansiToSegments("\x1b[?900htest", false);
  assert.equal(segs.length, 1);
  assert.equal(segs[0].text, "test");
});

test("incomplete CSI at end of string is stripped", () => {
  const segs = ansiToSegments("\x1b[23;", false);
  assert.equal(segs.length, 1);
  assert.equal(segs[0].text, "");
});

test("OSC title sequence is stripped", () => {
  const segs = ansiToSegments("\x1b]0;title\x07after", false);
  assert.equal(segs.length, 1);
  assert.equal(segs[0].text, "after");
});

test("mixed SGR and non-SGR in same string", () => {
  const raw = "\x1b[?900h\x1b[31mred\x1b[0m normal";
  const segs = ansiToSegments(raw, false);
  assert.equal(segs.length, 2);
  assert.equal(segs[0].text, "red");
  assert.equal(segs[0].style.color, "#cd3131");
  assert.equal(segs[1].text, " normal");
});

test("multiple SGR codes in one sequence", () => {
  const segs = ansiToSegments("\x1b[1;4;31mtext\x1b[0m", false);
  assert.equal(segs.length, 1);
  assert.equal(segs[0].text, "text");
  assert.equal(segs[0].style.fontWeight, "700");
  assert.equal(segs[0].style.textDecorationLine, "underline");
  assert.equal(segs[0].style.color, "#cd3131");
});

test("SGR background colors", () => {
  const segs = ansiToSegments("\x1b[41mred bg\x1b[0m", false);
  assert.equal(segs.length, 1);
  assert.equal(segs[0].text, "red bg");
  assert.equal(segs[0].style.backgroundColor, "#cd3131");
});

test("SGR bright colors", () => {
  const segs = ansiToSegments("\x1b[91mbright red\x1b[0m", false);
  assert.equal(segs.length, 1);
  assert.equal(segs[0].text, "bright red");
  assert.equal(segs[0].style.color, "#f14c4c");
});

test("SGR dim", () => {
  const segs = ansiToSegments("\x1b[2mdim\x1b[0m", false);
  assert.equal(segs.length, 1);
  assert.equal(segs[0].text, "dim");
  assert.equal(segs[0].style.color, "#999999");
});

test("SGR italic", () => {
  const segs = ansiToSegments("\x1b[3mitalic\x1b[0m", false);
  assert.equal(segs.length, 1);
  assert.equal(segs[0].text, "italic");
  assert.equal(segs[0].style.fontStyle, "italic");
});

test("SGR underline", () => {
  const segs = ansiToSegments("\x1b[4munderline\x1b[0m", false);
  assert.equal(segs.length, 1);
  assert.equal(segs[0].text, "underline");
  assert.equal(segs[0].style.textDecorationLine, "underline");
});

test("SGR 22 resets bold and dim", () => {
  const segs = ansiToSegments("\x1b[1m\x1b[22mtext", false);
  assert.equal(segs.length, 1);
  assert.equal(segs[0].text, "text");
  assert.equal(segs[0].style.fontWeight, "400");
});

test("SGR 23 resets italic", () => {
  const segs = ansiToSegments("\x1b[3m\x1b[23mtext", false);
  assert.equal(segs.length, 1);
  assert.equal(segs[0].text, "text");
  assert.equal(segs[0].style.fontStyle, "normal");
});

test("SGR 24 resets underline", () => {
  const segs = ansiToSegments("\x1b[4m\x1b[24mtext", false);
  assert.equal(segs.length, 1);
  assert.equal(segs[0].text, "text");
  assert.equal(segs[0].style.textDecorationLine, "none");
});

test("dark mode default colors", () => {
  const segs = ansiToSegments("hello", true);
  assert.equal(segs[0].style.color, "#e5e5e5");
  assert.equal(segs[0].style.backgroundColor, "#0a0a0a");
});

test("trailing text without SGR reset", () => {
  const segs = ansiToSegments("\x1b[31mred", false);
  assert.equal(segs.length, 1);
  assert.equal(segs[0].text, "red");
  assert.equal(segs[0].style.color, "#cd3131");
});

test("unknown CSI sequence is stripped", () => {
  const segs = ansiToSegments("\x1b[2Jtest", false);
  assert.equal(segs.length, 1);
  assert.equal(segs[0].text, "test");
});
