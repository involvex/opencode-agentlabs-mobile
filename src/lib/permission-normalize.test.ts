import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizePermission } from "./permission-normalize.ts";

test("adapts V2 SSE shape action/resources to permission/patterns", () => {
  const out = normalizePermission({
    id: "req-1",
    sessionID: "ses-1",
    action: "bash",
    resources: ["ls", "pwd"],
  });
  assert.equal(out.permission, "bash");
  assert.deepEqual(out.patterns, ["ls", "pwd"]);
});

test("missing resources yields empty patterns (no crash)", () => {
  const out = normalizePermission({
    id: "req-2",
    sessionID: "ses-1",
    action: "edit",
  });
  assert.deepEqual(out.patterns, []);
});

test("legacy shape permission/patterns passes through", () => {
  const out = normalizePermission({
    id: "req-3",
    sessionID: "ses-1",
    permission: "read",
    patterns: ["a.txt"],
  });
  assert.equal(out.permission, "read");
  assert.deepEqual(out.patterns, ["a.txt"]);
});

test("null/undefined patterns coerced to empty array", () => {
  const out = normalizePermission({
    id: "req-4",
    sessionID: "ses-1",
    permission: "bash",
    patterns: undefined,
  });
  assert.deepEqual(out.patterns, []);
});

test("single string resources coerced to array", () => {
  const out = normalizePermission({
    id: "req-5",
    sessionID: "ses-1",
    action: "bash",
    resources: "ls -la",
  });
  assert.deepEqual(out.patterns, ["ls -la"]);
});

test("non-string pattern entries filtered", () => {
  const out = normalizePermission({
    id: "req-6",
    sessionID: "ses-1",
    action: "bash",
    resources: ["ok", 42, null],
  });
  assert.deepEqual(out.patterns, ["ok"]);
});
