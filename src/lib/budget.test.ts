import { test } from "node:test";
import assert from "node:assert/strict";
import type { Message } from "./sdk";
import { budgetState, sumMessageUsage, todayKey } from "./budget.ts";

function msg(partial: Record<string, unknown>): Message {
  return partial as unknown as Message;
}

test("sumMessageUsage: sums assistant cost and output tokens only", () => {
  const totals = sumMessageUsage([
    msg({ role: "user" }),
    msg({ role: "assistant", cost: 0.5, tokens: { input: 100, output: 200 } }),
    msg({
      role: "assistant",
      cost: 1.25,
      tokens: { input: 50, output: 300, reasoning: 10 },
    }),
  ]);
  assert.equal(totals.cost, 1.75);
  assert.equal(totals.outputTokens, 500);
});

test("sumMessageUsage: ignores missing/non-finite values and non-assistant rows", () => {
  const totals = sumMessageUsage([
    msg({ role: "assistant", tokens: {} }),
    msg({ role: "assistant", cost: Number.NaN }),
    msg({ tokens: { output: -1 } }),
  ]);
  assert.equal(totals.cost, 0);
  assert.equal(totals.outputTokens, 0);
});

test("sumMessageUsage: tolerates undefined input", () => {
  const totals = sumMessageUsage(undefined);
  assert.deepEqual(totals, { cost: 0, outputTokens: 0 });
});

test("budgetState: off when limit is zero or negative", () => {
  assert.equal(budgetState(9999, 0), "off");
  assert.equal(budgetState(9999, -5), "off");
});

test("budgetState: ok below limit, exceeded at or above it", () => {
  assert.equal(budgetState(4.99, 5), "ok");
  assert.equal(budgetState(5, 5), "exceeded");
  assert.equal(budgetState(6, 5), "exceeded");
});

test("todayKey: formats local date zero-padded", () => {
  assert.equal(todayKey(new Date(2026, 7, 26)), "2026-08-26");
  assert.equal(todayKey(new Date(2026, 0, 3)), "2026-01-03");
});
