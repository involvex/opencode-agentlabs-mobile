import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_QUICK_ACTIONS,
  MAX_QUICK_ACTIONS,
  mergeQuickActions,
  quickActionSubtitle,
  resolveQuickAction,
  validateQuickAction,
  type QuickAction,
} from "./quick-actions.ts";

describe("quick-actions", () => {
  test("defaults ship five presets with summarize wired as command", () => {
    assert.equal(DEFAULT_QUICK_ACTIONS.length, 5);
    const summarize = DEFAULT_QUICK_ACTIONS.find((a) => a.id === "summarize");
    assert.equal(summarize?.kind, "command");
    if (summarize?.kind === "command") {
      assert.equal(summarize.trigger, "summarize");
    }
  });

  test("text action resolves to insert", () => {
    const action: QuickAction = {
      id: "a",
      label: "Lint",
      kind: "text",
      text: "Fix lint errors.",
    };
    assert.deepEqual(resolveQuickAction(action, ["summarize"], ["commit"]), {
      type: "insert",
      text: "Fix lint errors.",
    });
  });

  test("command matching a builtin resolves to builtin", () => {
    const action: QuickAction = {
      id: "a",
      label: "Summary",
      kind: "command",
      trigger: "Summarize",
      args: "",
    };
    assert.deepEqual(resolveQuickAction(action, ["summarize"], ["commit"]), {
      type: "builtin",
      trigger: "Summarize",
      args: "",
    });
  });

  test("command matching a server command resolves to server-command", () => {
    const action: QuickAction = {
      id: "a",
      label: "Review",
      kind: "command",
      trigger: "review",
      args: "HEAD",
    };
    assert.deepEqual(resolveQuickAction(action, ["summarize"], ["review"]), {
      type: "server-command",
      trigger: "review",
      args: "HEAD",
    });
  });

  test("stale trigger degrades to insert-text with slash prefix", () => {
    const action: QuickAction = {
      id: "a",
      label: "Old",
      kind: "command",
      trigger: "renamed-cmd",
      args: "foo",
    };
    assert.deepEqual(resolveQuickAction(action, ["summarize"], ["commit"]), {
      type: "insert",
      text: "/renamed-cmd foo",
    });
  });

  test("validate rejects empty label, long label, empty text, bad trigger", () => {
    assert.ok(
      validateQuickAction({ id: "a", label: " ", kind: "text", text: "x" }),
    );
    assert.ok(
      validateQuickAction({
        id: "a",
        label: "x".repeat(21),
        kind: "text",
        text: "x",
      }),
    );
    assert.ok(
      validateQuickAction({ id: "a", label: "Ok", kind: "text", text: " " }),
    );
    assert.ok(
      validateQuickAction({
        id: "a",
        label: "Ok",
        kind: "command",
        trigger: "has space",
      }),
    );
    assert.equal(
      validateQuickAction({
        id: "a",
        label: "Ok",
        kind: "command",
        trigger: "review",
      }),
      null,
    );
  });

  test("merge returns null for missing storage (first run)", () => {
    assert.equal(mergeQuickActions(null), null);
    assert.equal(mergeQuickActions(undefined), null);
    assert.equal(mergeQuickActions("garbage"), null);
  });

  test("merge honors an empty array (user hid the bar)", () => {
    assert.deepEqual(mergeQuickActions([]), []);
  });

  test("merge drops malformed entries and caps length", () => {
    const stored = [
      { id: "ok", label: "Ok", kind: "text", text: "hi" },
      { id: "bad" },
      "nope",
      null,
    ];
    const merged = mergeQuickActions(stored);
    assert.deepEqual(merged, [
      { id: "ok", label: "Ok", kind: "text", text: "hi" },
    ]);
    const many = Array.from({ length: MAX_QUICK_ACTIONS + 4 }, (_, i) => ({
      id: `a${i}`,
      label: `A${i}`,
      kind: "text",
      text: "hi",
    }));
    assert.equal(mergeQuickActions(many)?.length, MAX_QUICK_ACTIONS);
  });

  test("subtitle shows text or slash trigger", () => {
    assert.equal(
      quickActionSubtitle({
        id: "a",
        label: "L",
        kind: "text",
        text: "hello",
      }),
      "hello",
    );
    assert.equal(
      quickActionSubtitle({
        id: "a",
        label: "L",
        kind: "command",
        trigger: "review",
        args: "HEAD",
      }),
      "/review HEAD",
    );
  });
});
