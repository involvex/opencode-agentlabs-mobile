import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_TERM_CTRL,
  DEFAULT_TERM_NAV,
  describeSequence,
  formatSequenceForEdit,
  mergeTermKeys,
  parseSequenceInput,
  validateTermKey,
} from "./terminal-keys.ts";

const ESC = String.fromCharCode(27);
const TAB = String.fromCharCode(9);
const CTRL_C = String.fromCharCode(3);
const CTRL_V = String.fromCharCode(22);

describe("terminal-keys", () => {
  test("defaults match the legacy hardcoded rows", () => {
    assert.deepEqual(
      DEFAULT_TERM_NAV.map((k) => k.label),
      ["↑", "↓", "←", "→", "Home", "End"],
    );
    assert.deepEqual(
      DEFAULT_TERM_CTRL.map((k) => k.label),
      ["Tab", "Esc", "Ctrl+C", "Ctrl+V"],
    );
    const sequences = new Map(DEFAULT_TERM_CTRL.map((k) => [k.id, k.sequence]));
    assert.equal(sequences.get("tab"), TAB);
    assert.equal(sequences.get("esc"), ESC);
    assert.equal(sequences.get("ctrl-c"), CTRL_C);
    assert.equal(sequences.get("ctrl-v"), CTRL_V);
    assert.equal(DEFAULT_TERM_NAV[0].sequence, `${ESC}[A`);
  });

  test("validate rejects empty label and empty sequence", () => {
    assert.ok(validateTermKey({ id: "a", label: " ", sequence: "x" }));
    assert.ok(validateTermKey({ id: "a", label: "Ok", sequence: "" }));
    assert.ok(
      validateTermKey({ id: "a", label: "x".repeat(9), sequence: "x" }),
    );
    assert.equal(
      validateTermKey({ id: "a", label: "Ok", sequence: "x" }),
      null,
    );
  });

  test("merge returns null for missing storage (first run)", () => {
    assert.equal(mergeTermKeys(null, DEFAULT_TERM_NAV), null);
    assert.equal(mergeTermKeys(undefined, DEFAULT_TERM_NAV), null);
    assert.equal(mergeTermKeys("garbage", DEFAULT_TERM_NAV), null);
  });

  test("merge keeps valid entries and drops malformed ones", () => {
    const merged = mergeTermKeys(
      [
        { id: "up", label: "Up!", sequence: `${ESC}[A` },
        { id: "bad", label: "", sequence: "" },
        "nope",
      ],
      DEFAULT_TERM_NAV,
    );
    assert.deepEqual(merged, [
      { id: "up", label: "Up!", sequence: `${ESC}[A` },
    ]);
  });

  test("describeSequence renders control chars readably", () => {
    assert.equal(describeSequence(`${ESC}[A`), "<Esc>[A");
    assert.equal(describeSequence(TAB), "<Tab>");
    assert.equal(describeSequence(CTRL_C), "<Ctrl+C>");
    assert.equal(describeSequence("ls -la"), "ls -la");
  });

  test("format/parse sequence round-trips", () => {
    const bs = String.fromCharCode(92);
    assert.equal(formatSequenceForEdit(`${ESC}[A`), `${bs}e[A`);
    assert.equal(formatSequenceForEdit(TAB), `${bs}t`);
    assert.equal(formatSequenceForEdit(CTRL_C), `${bs}x03`);
    assert.equal(formatSequenceForEdit("ls -la"), "ls -la");
    assert.equal(parseSequenceInput(`${bs}e[A`), `${ESC}[A`);
    assert.equal(parseSequenceInput(`${bs}t`), TAB);
    assert.equal(parseSequenceInput(`${bs}x03`), CTRL_C);
    assert.equal(parseSequenceInput(`${bs}${bs}`), bs);
    assert.equal(parseSequenceInput("plain"), "plain");
    assert.equal(parseSequenceInput(`${bs}q`), `${bs}q`);
  });
});
