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

test("SGR 38;5;14 (256-color foreground) produces colored segment", () => {
  const segs = ansiToSegments("\x1b[38;5;14mtext\x1b[0m", false);
  assert.equal(segs.length, 1);
  assert.equal(segs[0].text, "text");
  assert.ok(segs[0].style.color, "expected a color to be set");
  assert.notEqual(segs[0].style.color, "#1a1a1a");
});

test("SGR 48;5;21 (256-color background) produces bg-colored segment", () => {
  const segs = ansiToSegments("\x1b[48;5;21mbg\x1b[0m", false);
  assert.equal(segs.length, 1);
  assert.equal(segs[0].text, "bg");
  assert.ok(segs[0].style.backgroundColor, "expected a background color");
});

test("SGR 38;2;255;128;64 (true-color foreground) produces colored segment", () => {
  const segs = ansiToSegments("\x1b[38;2;255;128;64mtrue\x1b[0m", false);
  assert.equal(segs.length, 1);
  assert.equal(segs[0].text, "true");
  assert.equal(segs[0].style.color, "#ff8040");
});

test("incomplete 256-color SGR at end of chunk does not leak as literal text", () => {
  const segs = ansiToSegments("\x1b[38;5;14", false);
  assert.ok(!segs[0].text.includes("[38"));
  assert.ok(!segs[0].text.includes("38;5;14"));
});

test("fragment SGR without ESC prefix (chunk split) does not leak", () => {
  const segs = ansiToSegments("[38;5;14mhello", false);
  assert.equal(segs.length, 1);
  assert.ok(!segs[0].text.includes("[38"));
  assert.ok(!segs[0].text.includes("38;5;14"));
});

test("fragment [m without ESC prefix does not leak", () => {
  const segs = ansiToSegments("[mhello", false);
  assert.equal(segs.length, 1);
  assert.equal(segs[0].text, "hello");
});

test("fragment [m at end of string does not leak", () => {
  const segs = ansiToSegments("[m", false);
  assert.equal(segs.length, 1);
  assert.equal(segs[0].text, "");
});

test("fragment [38;5;14 in middle of text does not leak", () => {
  const segs = ansiToSegments("prefix[38;5;14msuffix", false);
  assert.equal(segs.length, 1);
  assert.equal(segs[0].text, "prefixsuffix");
});

test("fragment [31 in middle of text does not leak", () => {
  const segs = ansiToSegments("a[31mb", false);
  assert.equal(segs.length, 1);
  assert.equal(segs[0].text, "ab");
});

test("incomplete CSI mid-line followed by valid SGR is stripped", () => {
  // \x1b[38;5;14 is incomplete (no final byte), followed by \x1b[0m (valid reset)
  const segs = ansiToSegments("\x1b[38;5;14\x1b[0mhello", false);
  assert.equal(segs.length, 1);
  assert.equal(segs[0].text, "hello");
});

test("incomplete CSI mid-line with text after is stripped", () => {
  // \x1b[38;5;14 followed by non-letter (0xff) — incomplete CSI
  const segs = ansiToSegments("a\x1b[38;5;14\xffb", false);
  assert.equal(segs.length, 1);
  assert.equal(segs[0].text, "aÿb");
});
