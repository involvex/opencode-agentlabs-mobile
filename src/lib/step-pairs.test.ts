import { test } from "node:test";
import assert from "node:assert/strict";
import { pairStepParts } from "./step-pairs.ts";
import type { Part } from "./sdk.ts";

// The real server's StepStartPart/StepFinishPart carry NO `text` — only
// snapshot? on start and reason/cost/tokens on finish. Pairing must work on
// shape alone, never on text content.
function start(id: string, extra: Partial<Part> = {}): Part {
  return { id, messageID: "msg-1", type: "step-start", ...extra };
}

function finish(id: string, extra: Partial<Part> = {}): Part {
  return {
    id,
    messageID: "msg-1",
    type: "step-finish",
    reason: "success",
    cost: 0.0012,
    tokens: { input: 100, output: 50 },
    ...extra,
  };
}

test("pairs textless server-shaped start/finish parts by position", () => {
  const pairs = pairStepParts([start("s1"), finish("f1"), start("s2")]);

  assert.equal(pairs.length, 2);
  assert.equal(pairs[0]?.start.id, "s1");
  assert.equal(pairs[0]?.finish?.id, "f1");
  assert.equal(pairs[0]?.index, 0);
  // Trailing unpaired start is kept as in-flight, not dropped
  assert.equal(pairs[1]?.start.id, "s2");
  assert.equal(pairs[1]?.finish, null);
  assert.equal(pairs[1]?.index, 1);
});

test("drops a stray finish with no open start", () => {
  const stray: Part = {
    id: "f0",
    messageID: "msg-1",
    type: "step-finish",
    reason: "success",
    cost: 0,
    tokens: { input: 0, output: 0 },
  };
  const pairs = pairStepParts([stray, start("s1"), finish("f1")]);

  assert.equal(pairs.length, 1);
  assert.equal(pairs[0]?.start.id, "s1");
  assert.equal(pairs[0]?.finish?.id, "f1");
});

test("orphaned start is stored before a newer start takes over", () => {
  const pairs = pairStepParts([start("s1"), start("s2"), finish("f2")]);

  assert.equal(pairs.length, 2);
  assert.equal(pairs[0]?.start.id, "s1");
  assert.equal(pairs[0]?.finish, null);
  assert.equal(pairs[1]?.start.id, "s2");
  assert.equal(pairs[1]?.finish?.id, "f2");
});

test("legacy text on step parts passes through untouched", () => {
  const pairs = pairStepParts([
    start("s1", { text: "Run tests" }),
    finish("f1", { text: "done" }),
  ]);

  assert.equal(pairs.length, 1);
  assert.equal(pairs[0]?.start.text, "Run tests");
  assert.equal(pairs[0]?.finish?.text, "done");
});
