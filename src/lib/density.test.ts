import { test } from "node:test";
import assert from "node:assert/strict";
import { ds, scaled } from "./density-helpers.ts";

const d = { padding: 0.6, font: 0.85, gap: 0.6 };

function approx(a: number, b: number, eps = 1e-9) {
  assert.ok(Math.abs(a - b) < eps, `expected ${b}, got ${a}`);
}

test("scaled multiplies base by multiplier", () => {
  approx(scaled(16, 1.0), 16);
  approx(scaled(16, 0.6), 9.6);
  approx(scaled(16, 1.4), 22.4);
});

test("ds scales padding properties", () => {
  const result = ds({ padding: 16, paddingHorizontal: 12 }, d);
  approx(result.padding, 9.6);
  approx(result.paddingHorizontal, 7.2);
});

test("ds scales margin properties", () => {
  const result = ds({ marginTop: 8, marginBottom: 4 }, d);
  approx(result.marginTop, 4.8);
  approx(result.marginBottom, 2.4);
});

test("ds scales fontSize", () => {
  const result = ds({ fontSize: 14 }, d);
  approx(result.fontSize, 11.9);
});

test("ds scales gap", () => {
  const result = ds({ gap: 10 }, d);
  approx(result.gap, 6);
});

test("ds leaves non-numeric values unchanged", () => {
  const result = ds({ color: "#ffffff", borderRadius: 8 }, d);
  assert.equal(result.color, "#ffffff");
  approx(result.borderRadius, 8);
});

test("ds scales mixed properties correctly", () => {
  const result = ds(
    { padding: 16, gap: 8, fontSize: 14, marginTop: 4, borderRadius: 8 },
    d,
  );
  approx(result.padding, 9.6);
  approx(result.gap, 4.8);
  approx(result.fontSize, 11.9);
  approx(result.marginTop, 2.4);
  approx(result.borderRadius, 8);
});

test("ds does not mutate the input object", () => {
  const input = { padding: 16, fontSize: 14 };
  ds(input, d);
  assert.equal(input.padding, 16);
  assert.equal(input.fontSize, 14);
});
